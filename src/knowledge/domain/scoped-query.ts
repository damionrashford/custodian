import type { Namespace, Result } from "@custodian/primitives";
import { namespaceFor } from "./namespace";
import type { VerifiedTenantClaim } from "./tenant-claim";

export type ScopedQuery = {
  readonly namespace: Namespace;
  readonly embedding: readonly number[];
  readonly topK: number;
};

export type RetrievalFailure = { readonly kind: "index-unavailable"; readonly reason: string };

export type Match = {
  readonly namespace: Namespace;
  readonly documentId: string;
  readonly score: number;
};

export interface VectorIndex {
  query(query: ScopedQuery): Promise<Result<readonly Match[], RetrievalFailure>>;
}

/**
 * The namespace is derived here, not accepted here. A caller cannot pass one in, which is what makes
 * cross-tenant retrieval unrepresentable rather than merely forbidden.
 */
export function scopedQuery(
  claim: VerifiedTenantClaim,
  embedding: readonly number[],
  topK: number,
): ScopedQuery {
  return { namespace: namespaceFor(claim), embedding, topK };
}
