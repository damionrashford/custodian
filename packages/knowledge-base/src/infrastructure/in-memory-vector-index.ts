import { ok, type Namespace, type Result } from "@custodian/domain-primitives";
import type { Match, RetrievalFailure, ScopedQuery, VectorIndex } from "../domain/scoped-query";

export type IndexedDocument = {
  readonly namespace: Namespace;
  readonly documentId: string;
  readonly embedding: readonly number[];
};

export class InMemoryVectorIndex implements VectorIndex {
  readonly #documents: readonly IndexedDocument[];

  constructor(documents: readonly IndexedDocument[]) {
    this.#documents = documents;
  }

  query(query: ScopedQuery): Promise<Result<readonly Match[], RetrievalFailure>> {
    // Namespace filter BEFORE scoring: a cross-tenant document must never even be a candidate,
    // so no similarity value can pull it into the result.
    const scored = this.#documents
      .filter((document) => document.namespace === query.namespace)
      .map((document) => ({
        namespace: document.namespace,
        documentId: document.documentId,
        score: cosine(document.embedding, query.embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, query.topK);
    return Promise.resolve(ok(scored));
  }
}

function cosine(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  const norm = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return norm === 0 ? 0 : dot / norm;
}
