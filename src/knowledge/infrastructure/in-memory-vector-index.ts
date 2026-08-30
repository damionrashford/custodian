import type { SubjectKeyStore } from "@custodian/custody";
import {
  err,
  ok,
  isTerminalFailure,
  type KeyStoreFailure,
  type Namespace,
  type Result,
  type RetentionBucket,
  type SealedContent,
  type SubjectId,
} from "@custodian/primitives";
import type { Match, RetrievalFailure, ScopedQuery, VectorIndex } from "../domain/scoped-query";
import { cosine } from "../domain/cosine";
import { decodeEmbedding, encodeEmbedding } from "../domain/embedding-payload";

export type IndexedDocument = {
  readonly namespace: Namespace;
  readonly documentId: string;
  readonly embedding: SealedContent;
};

/**
 * The data map gives the vector index exactly one erasure mechanism: "Key destruction — soft delete
 * is insufficient" (Data_Protection_and_Retention.txt:49-50). A plaintext embedding left behind
 * after key destruction is a recovered fragment, and the release gate at :110-112 fails a release on
 * any recovered fragment — inversion attacks reconstruct enough source text that a bare vector is
 * not defensibly non-personal.
 */
export async function sealEmbedding(
  keys: SubjectKeyStore,
  request: {
    readonly subject: SubjectId;
    readonly bucket: RetentionBucket;
    readonly embedding: readonly number[];
  },
): Promise<Result<SealedContent, KeyStoreFailure>> {
  return keys.seal({
    subject: request.subject,
    bucket: request.bucket,
    plaintext: encodeEmbedding(request.embedding),
  });
}

export class InMemoryVectorIndex implements VectorIndex {
  #documents: readonly IndexedDocument[];
  readonly #keys: SubjectKeyStore;

  constructor(options: {
    readonly documents: readonly IndexedDocument[];
    readonly keys: SubjectKeyStore;
  }) {
    this.#documents = options.documents;
    this.#keys = options.keys;
  }

  async query(query: ScopedQuery): Promise<Result<readonly Match[], RetrievalFailure>> {
    // Namespace filter BEFORE anything else: a cross-tenant document must never even be a
    // candidate, so no similarity value can pull it into the result — and no other tenant's key is
    // ever asked for, which would be the same breach one layer down.
    const candidates = this.#documents.filter((document) => document.namespace === query.namespace);

    const scored: Match[] = [];
    const unreadable = new Set<IndexedDocument>();
    for (const document of candidates) {
      const opened = await this.#keys.unseal(document.embedding);
      if (!opened.ok) {
        // A custodian we could not reach is not an erasure. Refusing the whole query is the honest
        // answer — quietly returning the documents that happened to unseal would hand the caller a
        // silently short result set and call it a search.
        if (!isTerminalFailure(opened.error)) {
          return err({ kind: "index-unavailable", reason: opened.error.kind });
        }
        unreadable.add(document);
        continue;
      }
      const embedding = decodeEmbedding(opened.value);
      if (embedding === undefined) {
        unreadable.add(document);
        continue;
      }
      scored.push({
        namespace: document.namespace,
        documentId: document.documentId,
        score: cosine(embedding, query.embedding),
      });
    }

    // Dropped on read, mirroring the response cache: an entry whose key is gone can never become
    // readable again, so keeping it means paying an unwrap on every future query to learn the same
    // thing. This is the erasure becoming visible in the index rather than only in the key store.
    if (unreadable.size > 0) {
      this.#documents = this.#documents.filter((document) => !unreadable.has(document));
    }

    scored.sort((left, right) => right.score - left.score);
    return ok(scored.slice(0, query.topK));
  }

  size(): number {
    return this.#documents.length;
  }
}
