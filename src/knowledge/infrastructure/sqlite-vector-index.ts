import { Database } from "bun:sqlite";
import type { SubjectKeyStore } from "@custodian/custody";
import {
  isRecord,
  ok,
  parseRetentionBucket,
  parseSubjectId,
  type Namespace,
  type Result,
  type SealedContent,
} from "@custodian/primitives";
import type { Match, RetrievalFailure, ScopedQuery, VectorIndex } from "../domain/scoped-query";
import { cosine } from "../domain/cosine";
import { decodeEmbedding } from "../domain/embedding-payload";
import type { IndexedDocument } from "./in-memory-vector-index";

type DocumentRow = {
  readonly documentId: string;
  readonly sealed: string;
};

/**
 * The durable vector index.
 *
 * In memory, the index dies with the process while the execution log does not, and that combination
 * is its own defect: a run's log entry records a retrieval with provenance, and after a restart the
 * index that produced it is gone. The evidence survives and the thing it points at does not, which
 * is the same shape as durable ciphertext with ephemeral keys — the log is the artefact the whole
 * compliance position rests on, so it must not outlive what it cites.
 *
 * Embeddings are stored sealed, never as vectors, because the data map gives this location exactly
 * one erasure mechanism: "Key destruction — soft delete is insufficient"
 * (Data_Protection_and_Retention.txt:49-50).
 */
export class SqliteVectorIndex implements VectorIndex {
  readonly #db: Database;
  readonly #keys: SubjectKeyStore;

  constructor(options: { readonly path: string; readonly keys: SubjectKeyStore }) {
    this.#keys = options.keys;
    this.#db = new Database(options.path, { create: true, strict: true });
    this.#db.run("PRAGMA journal_mode = WAL;");
    this.#db.run("PRAGMA busy_timeout = 5000;");
    this.#db.run(
      `CREATE TABLE IF NOT EXISTS documents (
        namespace TEXT NOT NULL,
        document_id TEXT NOT NULL,
        sealed TEXT NOT NULL,
        PRIMARY KEY (namespace, document_id)
      ) WITHOUT ROWID;`,
    );
  }

  upsert(document: IndexedDocument): void {
    this.#db.run(
      `INSERT INTO documents (namespace, document_id, sealed) VALUES (?, ?, ?)
       ON CONFLICT (namespace, document_id) DO UPDATE SET sealed = excluded.sealed`,
      [document.namespace, document.documentId, JSON.stringify(document.embedding)],
    );
  }

  async query(query: ScopedQuery): Promise<Result<readonly Match[], RetrievalFailure>> {
    // Namespace filter in the WHERE clause, so a cross-tenant document is never a candidate and no
    // other tenant's key is ever asked for — the same breach one layer down.
    const rows = this.#db
      .query<DocumentRow, [string]>(
        "SELECT document_id AS documentId, sealed FROM documents WHERE namespace = ?",
      )
      .all(query.namespace);

    const scored: Match[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const sealed = parseSealed(row.sealed);
      const embedding = sealed === undefined ? undefined : await this.#embeddingOf(sealed);
      if (embedding === undefined) {
        unreadable.push(row.documentId);
        continue;
      }
      scored.push({
        namespace: query.namespace,
        documentId: row.documentId,
        score: cosine(embedding, query.embedding),
      });
    }

    // Dropped on read, mirroring the in-memory index and the response cache (LD-9). An entry whose
    // key is gone can never become readable again, so the row is deleted rather than re-unwrapped
    // on every future query — and this is the erasure becoming visible on disk, not just in the KMS.
    for (const documentId of unreadable) {
      this.#db.run("DELETE FROM documents WHERE namespace = ? AND document_id = ?", [
        query.namespace,
        documentId,
      ]);
    }

    scored.sort((left, right) => right.score - left.score);
    return ok(scored.slice(0, query.topK));
  }

  size(): number {
    const row = this.#db
      .query<{ readonly count: number }, []>("SELECT COUNT(*) AS count FROM documents")
      .get();
    return row === null ? 0 : row.count;
  }

  /** Tenant offboarding: the data map disposes this location by namespace drop, not by clock. */
  dropNamespace(namespace: Namespace): number {
    return this.#db.run("DELETE FROM documents WHERE namespace = ?", [namespace]).changes;
  }

  close(): void {
    this.#db.close();
  }

  async #embeddingOf(sealed: SealedContent): Promise<readonly number[] | undefined> {
    const opened = await this.#keys.unseal(sealed);
    return opened.ok ? decodeEmbedding(opened.value) : undefined;
  }
}

/** A stored row is untrusted input; it crosses the same parsers that admitted it. */
function parseSealed(stored: string): SealedContent | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const subject = parsed["subject"];
  const bucket = parsed["bucket"];
  const iv = parsed["iv"];
  const ciphertext = parsed["ciphertext"];
  const wrappedSubjectKey = parsed["wrappedSubjectKey"];
  const wrappedBucketKey = parsed["wrappedBucketKey"];
  if (
    typeof subject !== "string" ||
    typeof bucket !== "string" ||
    typeof iv !== "string" ||
    typeof ciphertext !== "string" ||
    typeof wrappedSubjectKey !== "string" ||
    typeof wrappedBucketKey !== "string"
  ) {
    return undefined;
  }
  const parsedSubject = parseSubjectId(subject);
  const parsedBucket = parseRetentionBucket(bucket);
  if (!parsedSubject.ok || !parsedBucket.ok) {
    return undefined;
  }
  return {
    subject: parsedSubject.value,
    bucket: parsedBucket.value,
    iv,
    ciphertext,
    wrappedSubjectKey,
    wrappedBucketKey,
  };
}
