import { Database } from "bun:sqlite";
import {
  err,
  isRecord,
  ok,
  parseRetentionBucket,
  parseSubjectId,
  type Namespace,
  type Result,
} from "@custodian/domain-primitives";
import {
  CLAIM_TTL_MS,
  isExpired,
  type Claim,
  type ClaimResult,
  type IdempotencyFailure,
  type IdempotencyStore,
  type RecordedOutcome,
} from "../domain/idempotency-store";
import type { RequestHash } from "../domain/request-hash";

type ClaimRow = {
  readonly claimed_at: string;
  readonly expires_at: string;
  readonly outcome: string | null;
};

type ExpiredRow = { readonly namespace: string; readonly request: string };

/**
 * The durable claim ledger. In-memory, the whole defence evaporates on restart: a redelivery that
 * arrives after a deploy or a crash meets an empty store, so the work runs and bills twice — the
 * exact double-execution the claim exists to prevent, and invisible to every test that exercises
 * one process.
 *
 * The claim is written before the work starts and the outcome lands later, so a claim with no
 * outcome is the in-flight marker a redelivery must see.
 */
export class SqliteIdempotencyStore implements IdempotencyStore {
  readonly #db: Database;

  constructor(path: string) {
    this.#db = new Database(path, { create: true, strict: true });
    this.#db.run("PRAGMA journal_mode = WAL;");
    this.#db.run("PRAGMA busy_timeout = 5000;");
    this.#db.run(
      `CREATE TABLE IF NOT EXISTS claims (
        namespace TEXT NOT NULL,
        request TEXT NOT NULL,
        claimed_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        outcome TEXT,
        PRIMARY KEY (namespace, request)
      ) WITHOUT ROWID;`,
    );
  }

  claim(
    namespace: Namespace,
    request: RequestHash,
    at: string,
  ): Promise<Result<ClaimResult, IdempotencyFailure>> {
    // Read and write inside one immediate transaction: two deliveries racing outside it would both
    // see no claim, both insert, and the loser would take a primary-key error instead of the
    // already-claimed answer that tells it not to run.
    this.#db.run("BEGIN IMMEDIATE;");
    try {
      const result = this.#claimLocked(namespace, request, at);
      this.#db.run("COMMIT;");
      return Promise.resolve(ok(result));
    } catch (cause) {
      try {
        this.#db.run("ROLLBACK;");
      } catch {
        // The original failure is the story; a failed rollback must not replace it.
      }
      throw cause;
    }
  }

  #claimLocked(namespace: Namespace, request: RequestHash, at: string): ClaimResult {
    const existing = this.#read(namespace, request);
    // An expired claim is not a claim. Treating it as one would dedupe a legitimate later request.
    if (existing !== undefined && !isExpired(existing, at)) {
      return { kind: "already-claimed", claim: existing };
    }
    const claim: Claim = {
      namespace,
      request,
      claimedAt: at,
      expiresAt: new Date(Date.parse(at) + CLAIM_TTL_MS).toISOString(),
      outcome: undefined,
    };
    this.#db.run(
      `INSERT INTO claims (namespace, request, claimed_at, expires_at, outcome)
       VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT (namespace, request)
       DO UPDATE SET claimed_at = excluded.claimed_at, expires_at = excluded.expires_at, outcome = NULL`,
      [namespace, request, claim.claimedAt, claim.expiresAt],
    );
    return { kind: "claimed", claim };
  }

  complete(
    namespace: Namespace,
    request: RequestHash,
    outcome: RecordedOutcome,
  ): Promise<Result<Claim, IdempotencyFailure>> {
    const existing = this.#read(namespace, request);
    if (existing === undefined) {
      return Promise.resolve(err({ kind: "unknown-claim", request }));
    }
    this.#db.run("UPDATE claims SET outcome = ? WHERE namespace = ? AND request = ?", [
      JSON.stringify(outcome),
      namespace,
      request,
    ]);
    return Promise.resolve(ok({ ...existing, outcome }));
  }

  /**
   * Drops claims past their TTL. Without a sweep the ledger only grows: the TTL bounds how long a
   * claim *answers* a redelivery, not how long its row occupies the disk.
   */
  sweepExpired(now: string): number {
    const stale = this.#db
      .query<ExpiredRow, [string]>("SELECT namespace, request FROM claims WHERE expires_at <= ?")
      .all(now);
    for (const row of stale) {
      this.#db.run("DELETE FROM claims WHERE namespace = ? AND request = ?", [
        row.namespace,
        row.request,
      ]);
    }
    return stale.length;
  }

  close(): void {
    this.#db.close();
  }

  #read(namespace: Namespace, request: RequestHash): Claim | undefined {
    const row = this.#db
      .query<ClaimRow, [string, string]>(
        "SELECT claimed_at, expires_at, outcome FROM claims WHERE namespace = ? AND request = ?",
      )
      .get(namespace, request);
    if (row === null) {
      return undefined;
    }
    return {
      namespace,
      request,
      claimedAt: row.claimed_at,
      expiresAt: row.expires_at,
      outcome: parseOutcome(row.outcome),
    };
  }
}

/**
 * A stored row is untrusted input like any other, so it crosses back through the same parsers that
 * admitted it — a hand-edited or half-migrated row surfaces as "no outcome yet", never as a
 * completed result the caller would hand to a client.
 */
function parseOutcome(stored: string | null): RecordedOutcome | undefined {
  if (stored === null) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || !isRecord(parsed["body"])) {
    return undefined;
  }
  const status = parsed["status"];
  const body = parsed["body"];
  const iv = body["iv"];
  const ciphertext = body["ciphertext"];
  if (
    (status !== "succeeded" && status !== "failed") ||
    typeof body["subject"] !== "string" ||
    typeof body["bucket"] !== "string" ||
    typeof iv !== "string" ||
    typeof ciphertext !== "string"
  ) {
    return undefined;
  }
  const subject = parseSubjectId(body["subject"]);
  const bucket = parseRetentionBucket(body["bucket"]);
  if (!subject.ok || !bucket.ok) {
    return undefined;
  }
  return { status, body: { subject: subject.value, bucket: bucket.value, iv, ciphertext } };
}
