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
import { GENESIS_HASH, hashableEntry } from "../domain/append-entry";
import type { ExecutionLogStore, LogStoreFailure } from "../domain/execution-log-store";
import type { LoggedEntry } from "../domain/logged-entry";

type TailRow = { readonly seq: number; readonly hash: string };
type EntryRow = { readonly seq: number; readonly entry: string };
type RunRow = { readonly namespace: string; readonly runId: string; readonly lastAt: string };

/**
 * The durable half of C15 — "doubles as the compliance log store"
 * (AI_Agent_Implementation_Plan_v2.txt:249). Same write-time refusals as the in-memory adapter,
 * plus the property only a durable store needs: a row edited underneath the process — the edit
 * Compliance_and_Certification.txt:59 says disqualifies a log as evidence — fails its hash check
 * on read and comes back as corrupt-entry, never as data.
 */
export class SqliteExecutionLogStore implements ExecutionLogStore {
  readonly #db: Database;
  readonly #hasher: ContentHasher;

  constructor(path: string, hasher: ContentHasher) {
    this.#db = new Database(path, { create: true, strict: true });
    this.#hasher = hasher;
    this.#db.run("PRAGMA journal_mode = WAL;");
    this.#db.run(
      `CREATE TABLE IF NOT EXISTS entries (
        namespace TEXT NOT NULL,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        at TEXT NOT NULL,
        entry TEXT NOT NULL,
        PRIMARY KEY (namespace, run_id, seq)
      ) WITHOUT ROWID;`,
    );
  }

  append(
    namespace: Namespace,
    runId: RunId,
    entries: readonly LoggedEntry[],
  ): Promise<Result<void, LogStoreFailure>> {
    const tail = this.#db
      .query<TailRow, [string, string]>(
        "SELECT seq, json_extract(entry, '$.hash') AS hash FROM entries WHERE namespace = ? AND run_id = ? ORDER BY seq DESC LIMIT 1",
      )
      .get(namespace, runId);

    const storedCount = tail === null ? 0 : tail.seq + 1;
    if (entries.length < storedCount) {
      return Promise.resolve(
        err({ kind: "sequence-rewind", tail: storedCount - 1, received: entries.length - 1 }),
      );
    }

    const incoming = entries.slice(storedCount);
    const first = incoming[0];
    if (first === undefined) {
      return Promise.resolve(ok(undefined));
    }
    const expectedPrevious = tail === null ? GENESIS_HASH : tail.hash;
    if (first.previousHash !== expectedPrevious) {
      return Promise.resolve(
        err({ kind: "chain-diverged", expectedPrevious, received: first.previousHash }),
      );
    }

    const insert = this.#db.query(
      "INSERT INTO entries (namespace, run_id, seq, at, entry) VALUES (?, ?, ?, ?, ?)",
    );
    // BEGIN IMMEDIATE rather than the default deferred begin: the write lock is taken before the
    // first insert, so two processes appending to the same run contend at the lock instead of one
    // of them failing mid-batch with a partially written tail. Bun commits on return and rolls
    // back on throw, so a failed batch leaves no entries behind.
    const insertAll = this.#db.transaction(() => {
      for (const entry of incoming) {
        insert.run(namespace, runId, entry.seq, entry.at, canonicalJson(entry));
      }
    });
    insertAll.immediate();
    return Promise.resolve(ok(undefined));
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
      // The assertion is sound because the hash makes it so: the stored hash was computed over the
      // canonical JSON of a genuine LoggedEntry at write time, and it is recomputed from the parsed
      // row before the row is returned. A row that does not round-trip to those bytes cannot match.
      const parsed = JSON.parse(row.entry) as LoggedEntry;
      if (this.#hasher.hash(hashableEntry(parsed)) !== parsed.hash) {
        return Promise.resolve(err({ kind: "corrupt-entry", runId, seq: row.seq }));
      }
      entries.push(parsed);
    }
    return Promise.resolve(ok(entries));
  }

  /**
   * Disposal of whole runs at metadata expiry — the period comes from the schedule, never from a
   * number here (LD-9). Whole runs, never single entries: deleting one entry breaks the hash chain
   * of everything after it, turning lawful disposal into apparent tampering.
   */
  disposeExpiredRuns(now: string): number {
    const runs = this.#db
      .query<RunRow, []>(
        "SELECT namespace, run_id AS runId, MAX(at) AS lastAt FROM entries GROUP BY namespace, run_id",
      )
      .all();
    let disposed = 0;
    for (const run of runs) {
      if (isDueForDisposal("execution-log-metadata", run.lastAt, now)) {
        this.#db.run("DELETE FROM entries WHERE namespace = ? AND run_id = ?", [
          run.namespace,
          run.runId,
        ]);
        disposed += 1;
      }
    }
    return disposed;
  }
}
