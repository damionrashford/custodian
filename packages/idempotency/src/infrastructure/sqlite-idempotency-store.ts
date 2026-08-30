import { Database } from "bun:sqlite";
import {
  err,
  isRecord,
  ok,
  parseRetentionBucket,
  parseSubjectId,
  type Namespace,
  type Result,
  type SealedContent,
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
  readonly claimedAt: string;
  readonly expiresAt: string;
  readonly outcome: string | null;
};

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
    return Promise.resolve(ok(this.#transact(() => this.#claimLocked(namespace, request, at))));
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
    // OR REPLACE, because the only row this can conflict with is the expired claim just rejected
    // above — and it must be replaced outright, so a stale outcome cannot survive under a fresh
    // claim and answer the new request with the old one's result.
    this.#db.run(
      `INSERT OR REPLACE INTO claims (namespace, request, claimed_at, expires_at, outcome)
       VALUES (?, ?, ?, ?, NULL)`,
      [namespace, request, claim.claimedAt, claim.expiresAt],
    );
    return { kind: "claimed", claim };
  }

  complete(
    namespace: Namespace,
    request: RequestHash,
    outcome: RecordedOutcome,
  ): Promise<Result<Claim, IdempotencyFailure>> {
    // Same transaction as claim(), for the same reason: read-then-write outside one lets a
    // concurrent redelivery re-claim between the two statements, and this UPDATE would then attach
    // the finished outcome to a claim covering a different, still-running execution.
    return Promise.resolve(this.#transact(() => this.#completeLocked(namespace, request, outcome)));
  }

  #completeLocked(
    namespace: Namespace,
    request: RequestHash,
    outcome: RecordedOutcome,
  ): Result<Claim, IdempotencyFailure> {
    const existing = this.#read(namespace, request);
    if (existing === undefined) {
      return err({ kind: "unknown-claim", request });
    }
    this.#db.run("UPDATE claims SET outcome = ? WHERE namespace = ? AND request = ?", [
      JSON.stringify(outcome),
      namespace,
      request,
    ]);
    return ok({ ...existing, outcome });
  }

  /**
   * Drops claims past their TTL. Without a sweep the ledger only grows: the TTL bounds how long a
   * claim *answers* a redelivery, not how long its row occupies the disk.
   */
  sweepExpired(now: string): number {
    return this.#db.run("DELETE FROM claims WHERE expires_at <= ?", [now]).changes;
  }

  close(): void {
    this.#db.close();
  }

  #read(namespace: Namespace, request: RequestHash): Claim | undefined {
    const row = this.#db
      .query<ClaimRow, [string, string]>(
        `SELECT claimed_at AS claimedAt, expires_at AS expiresAt, outcome
         FROM claims WHERE namespace = ? AND request = ?`,
      )
      .get(namespace, request);
    if (row === null) {
      return undefined;
    }
    return {
      namespace,
      request,
      claimedAt: row.claimedAt,
      expiresAt: row.expiresAt,
      outcome: parseOutcome(row.outcome),
    };
  }

  #transact<T>(body: () => T): T {
    this.#db.run("BEGIN IMMEDIATE;");
    try {
      const result = body();
      this.#db.run("COMMIT;");
      return result;
    } catch (cause) {
      try {
        this.#db.run("ROLLBACK;");
      } catch {
        // The original failure is the story; a failed rollback must not replace it.
      }
      throw cause;
    }
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
  if (!isRecord(parsed)) {
    return undefined;
  }
  const status = parsed["status"];
  if (status !== "succeeded" && status !== "failed") {
    return undefined;
  }
  const body = parseSealedContent(parsed["body"]);
  if (body === undefined) {
    return undefined;
  }
  return { status, body };
}

function parseSealedContent(stored: unknown): SealedContent | undefined {
  if (!isRecord(stored)) {
    return undefined;
  }
  const subject = stored["subject"];
  const bucket = stored["bucket"];
  const iv = stored["iv"];
  const ciphertext = stored["ciphertext"];
  if (
    typeof subject !== "string" ||
    typeof bucket !== "string" ||
    typeof iv !== "string" ||
    typeof ciphertext !== "string"
  ) {
    return undefined;
  }
  const parsedSubject = parseSubjectId(subject);
  const parsedBucket = parseRetentionBucket(bucket);
  if (!parsedSubject.ok || !parsedBucket.ok) {
    return undefined;
  }
  return { subject: parsedSubject.value, bucket: parsedBucket.value, iv, ciphertext };
}
