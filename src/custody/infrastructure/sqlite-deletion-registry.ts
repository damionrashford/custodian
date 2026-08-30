import { Database } from "bun:sqlite";
import { disposalCutoff, isRecord, type ErasureProof } from "@custodian/primitives";
import type { DeletionRegistry } from "../domain/deletion-registry";
import type { CustodyKeyName } from "../domain/key-custodian";

type ProofRow = { readonly proof: string };

/**
 * The durable half of erasure evidence. In process, a restart loses every proof, and the next
 * erasure request for an already-erased subject mints a fresh one — truthful about the outcome,
 * wrong about when it happened, and a second record of a single destruction in the audit trail.
 */
export class SqliteDeletionRegistry implements DeletionRegistry {
  readonly #db: Database;

  constructor(path: string) {
    this.#db = new Database(path, { create: true, strict: true });
    this.#db.run("PRAGMA journal_mode = WAL;");
    this.#db.run("PRAGMA busy_timeout = 5000;");
    this.#db.run(
      `CREATE TABLE IF NOT EXISTS destructions (
        key_name TEXT PRIMARY KEY,
        proof TEXT NOT NULL
      ) WITHOUT ROWID;`,
    );
  }

  // INSERT OR IGNORE, never REPLACE: the first proof is the true one. A later destroy of the same
  // key must not overwrite the timestamp the original destruction actually happened at.
  record(name: CustodyKeyName, proof: ErasureProof): void {
    this.#db.run("INSERT OR IGNORE INTO destructions (key_name, proof) VALUES (?, ?)", [
      name,
      JSON.stringify(proof),
    ]);
  }

  lookup(name: CustodyKeyName): ErasureProof | undefined {
    const row = this.#db
      .query<ProofRow, [string]>("SELECT proof FROM destructions WHERE key_name = ?")
      .get(name);
    return row === null ? undefined : parseProof(row.proof);
  }

  /**
   * `json_extract` rather than a `destroyed_at` column, so the timestamp has exactly one home. A
   * column would be a second copy of a value the proof already carries, and the two could disagree
   * — which for an audit artefact is worse than the query being marginally slower.
   */
  disposeExpired(now: string): number {
    return this.#db.run(
      `DELETE FROM destructions
       WHERE json_extract(proof, '$.destroyedAt') IS NOT NULL
         AND json_extract(proof, '$.destroyedAt') <= ?`,
      [disposalCutoff("execution-log-metadata", now)],
    ).changes;
  }

  close(): void {
    this.#db.close();
  }
}

/** A stored row is untrusted input; it crosses back through a parser rather than an assertion. */
function parseProof(stored: string): ErasureProof | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const target = parsed["target"];
  const destroyedAt = parsed["destroyedAt"];
  const keyReference = parsed["keyReference"];
  const recordId = parsed["recordId"];
  const attestation = parsed["attestation"];
  if (
    typeof target !== "string" ||
    typeof destroyedAt !== "string" ||
    typeof keyReference !== "string" ||
    typeof recordId !== "string" ||
    (attestation !== "external" && attestation !== "self")
  ) {
    return undefined;
  }
  return { target, destroyedAt, keyReference, recordId, attestation };
}
