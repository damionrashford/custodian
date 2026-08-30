import type { Result } from "@custodian/domain-primitives";

export type EmbeddingFailure = { readonly kind: "embedding-unavailable"; readonly reason: string };

/**
 * Curate the model pool before tuning the router, and tune the router before changing the embedding
 * model — backbone embedding models have limited impact on retrieval quality compared with chunking
 * configuration (Agent_Architecture_Addendum.txt:55, AI_Agent_Implementation_Plan_v2.txt:150).
 */
export interface Embedder {
  embed(text: string): Promise<Result<readonly number[], EmbeddingFailure>>;
}
