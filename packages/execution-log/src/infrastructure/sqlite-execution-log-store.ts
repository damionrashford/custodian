import { Database } from "bun:sqlite";
import {
  canonicalJson,
  err,
  ok,
  type ContentHasher,
  type Namespace,
  type Result,
  type RunId,
} from "@custodian/domain-primitives";
import { isDueForDisposal } from "@custodian/retention";
import { validateAppend } from "../domain/append-entry";
import type { ExecutionLogStore, LogStoreFailure } from "../domain/execution-log-store";
import type { LoggedEntry } from "../domain/logged-entry";
import { verifyRunLog } from "../domain/verify-run-log";
import { parseStoredEntry } from "./parse-stored-entry";

type TailRow = { readonly seq: number; readonly hash: string };
type EntryRow = { readonly seq: number; readonly entry: string };
type RunKeyRow = { readonly namespace: string; readonly runId: string };

/**
 * The durable half of C15 — "doubles as the compliance log store"
 * (AI_Agent_Implementation_Plan_v2.txt:249).
 *
 * What the read path proves, precisely: every row re-verifies against its own hash and the whole
 * result re-verifies as a chain (verifyRunLog), so an entry edited in the database, a row whose
 * JSON no longer parses, an entry deleted from the middle, and a reordered or renumbered sequence
 * all come back as corrupt-entry — never as data. Two limits, stated rather than implied:
 * truncating the tail of a run that never recorded run-finished is indistinguishable from entries
 * not yet flushed, and an actor who can rewrite every row can recompute the unkeyed chain
 * wholesale — the defence there is an external anchor for chain heads, which is signing
 * infrastructure, not this adapter.
 */
export class SqliteExecutionLogStore implements ExecutionLogStore {
  readonly #db: Database;
  readonly #hasher: ContentHasher;

  constructor(path: string, hasher: ContentHasher) {
    this.#db = new Database(path, { create: true, strict: true });
    this.#hasher = hasher;
    this.#db.run("PRAGMA journal_mode = WAL;");
    // Without a busy timeout a second writer fails instantly with SQLITE_BUSY instead of waiting
    // its turn; with it, concurrent appenders queue at BEGIN IMMEDIATE. An expiry after this long
    // is infrastructure failure, not a refusal the LogStoreFailure union models, so it throws.
    this.#db.run("PRAGMA busy_timeout = 5000;");
    this.#db.run(
      `CREATE TABLE IF NOT EXISTS entries (
        namespace TEXT NOT NULL,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        entry TEXT NOT NULL,
        PRIMARY KEY (namespace, run_id, seq)
      ) WITHOUT ROWID;`,
    );
    this.#db.run(
      `CREATE TABLE IF NOT EXISTS disposed_runs (
        namespace TEXT NOT NULL,
        run_id TEXT NOT NULL,
        PRIMARY KEY (namespace, run_id)
      ) WITHOUT ROWID;`,
    );
  }

  append(
    namespace: Namespace,
    runId: RunId,
    entries: readonly LoggedEntry[],
  ): Promise<Result<void, LogStoreFailure>> {
    // The tail read happens inside BEGIN IMMEDIATE, so check-then-insert is atomic: a concurrent
    // appender waits at the lock and then sees the committed tail, rather than both passing the
    // chain check on a stale tail and the loser dying on the primary key.
    this.#db.run("BEGIN IMMEDIATE;");
    try {
      const result = this.#appendLocked(namespace, runId, entries);
      this.#db.run("COMMIT;");
      return Promise.resolve(result);
    } catch (cause) {
      try {
        this.#db.run("ROLLBACK;");
      } catch {
        // The original failure is the story; a failed rollback must not replace it.
      }
      throw cause;
    }
  }

  #appendLocked(
    namespace: string,
    runId: RunId,
    entries: readonly LoggedEntry[],
  ): Result<void, LogStoreFailure> {
    const buried = this.#db
      .query<{ readonly n: number }, [string, string]>(
        "SELECT 1 AS n FROM disposed_runs WHERE namespace = ? AND run_id = ?",
      )
      .get(namespace, runId);
    if (buried !== null) {
      return err({ kind: "run-disposed", runId });
    }

    const tail = this.#db
      .query<TailRow, [string, string]>(
        "SELECT seq, json_extract(entry, '$.hash') AS hash FROM entries WHERE namespace = ? AND run_id = ? ORDER BY seq DESC LIMIT 1",
      )
      .get(namespace, runId);

    const validated = validateAppend(
      tail === null ? 0 : tail.seq + 1,
      tail === null ? undefined : tail.hash,
      entries,
    );
    if (!validated.ok) {
      return validated;
    }

    const insert = this.#db.query(
      "INSERT INTO entries (namespace, run_id, seq, entry) VALUES (?, ?, ?, ?)",
    );
    for (const entry of validated.value) {
      insert.run(namespace, runId, entry.seq, canonicalJson(entry));
    }
    return ok(undefined);
  }

  read(
    namespace: Namespace,
    runId: RunId,
  ): Promise<Result<readonly LoggedEntry[], LogStoreFailure>> {
    const rows = this.#db
      .query<EntryRow, [string, string]>(
        "SELECT seq, entry FROM entries WHERE namespace = ? AND run_id = ? ORDER BY seq ASC",
      )
      .all(namespace, runId);
    if (rows.length === 0) {
      return Promise.resolve(err({ kind: "unknown-run", runId }));
    }

    const entries: LoggedEntry[] = [];
    for (const row of rows) {
      const parsed = parseStoredEntry(row.entry, this.#hasher);
      if (parsed === undefined || parsed.runId !== runId) {
        return Promise.resolve(err({ kind: "corrupt-entry", runId, seq: row.seq }));
      }
      entries.push(parsed);
    }

    const verified = verifyRunLog(entries, this.#hasher);
    if (!verified.ok) {
      const seq =
        verified.error.kind === "sequence-gap" ? verified.error.found : verified.error.seq;
      return Promise.resolve(err({ kind: "corrupt-entry", runId, seq }));
    }
    return Promise.resolve(ok(verified.value));
  }

  disposeExpiredRuns(now: string): Promise<number> {
    let disposed = 0;
    this.#db.run("BEGIN IMMEDIATE;");
    try {
      const runs = this.#db
        .query<RunKeyRow, []>("SELECT DISTINCT namespace, run_id AS runId FROM entries")
        .all();
      const remove = this.#db.query("DELETE FROM entries WHERE namespace = ? AND run_id = ?");
      const bury = this.#db.query(
        "INSERT OR IGNORE INTO disposed_runs (namespace, run_id) VALUES (?, ?)",
      );
      for (const run of runs) {
        // The disposal clock reads the hash-verified bytes, not a bare column: backdating a value
        // the hash does not cover would otherwise launder evidence destruction through the
        // retention sweep. A run that fails verification is left in place as evidence.
        const lastAt = this.#verifiedLastAt(run.namespace, run.runId);
        if (lastAt !== undefined && isDueForDisposal("execution-log-metadata", lastAt, now)) {
          remove.run(run.namespace, run.runId);
          bury.run(run.namespace, run.runId);
          disposed += 1;
        }
      }
      this.#db.run("COMMIT;");
    } catch (cause) {
      try {
        this.#db.run("ROLLBACK;");
      } catch {
        // The original failure is the story; a failed rollback must not replace it.
      }
      throw cause;
    }
    return Promise.resolve(disposed);
  }

  #verifiedLastAt(namespace: string, runId: string): string | undefined {
    const rows = this.#db
      .query<{ readonly entry: string }, [string, string]>(
        "SELECT entry FROM entries WHERE namespace = ? AND run_id = ? ORDER BY seq ASC",
      )
      .all(namespace, runId);
    let last: string | undefined;
    for (const row of rows) {
      const parsed = parseStoredEntry(row.entry, this.#hasher);
      if (parsed === undefined) {
        return undefined;
      }
      last = parsed.at;
    }
    return last;
  }
}
