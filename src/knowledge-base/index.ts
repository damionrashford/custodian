export type {
  ClaimContents,
  ClaimRejection,
  ClaimVerificationDeps,
  ClaimVerifier,
  VerifiedTenantClaim,
} from "./domain/tenant-claim";
export { MAX_CLAIM_LIFETIME_MS, verifyTenantClaim } from "./domain/tenant-claim";
export { namespaceFor } from "./domain/namespace";
export { Ed25519ClaimVerifier } from "./infrastructure/ed25519-claim-verifier";
export type { Match, RetrievalFailure, ScopedQuery, VectorIndex } from "./domain/scoped-query";
export { scopedQuery } from "./domain/scoped-query";
export type { IndexedDocument } from "./infrastructure/in-memory-vector-index";
export { InMemoryVectorIndex, sealEmbedding } from "./infrastructure/in-memory-vector-index";
