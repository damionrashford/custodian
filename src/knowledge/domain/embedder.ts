import type { Result } from "@custodian/primitives";

export type EmbeddingFailure = { readonly kind: "embedding-unavailable"; readonly reason: string };

/**
 * Curate the model pool before tuning the router, and tune the router before changing the embedding
 * model — backbone embedding models have limited impact on retrieval quality compared with chunking
 * configuration (architecture-addendum.txt:55, implementation-plan.txt:150).
 */
export interface Embedder {
  embed(text: string): Promise<Result<readonly number[], EmbeddingFailure>>;
}
