export type {
  ClaimContents,
  ClaimRejection,
  ClaimVerificationDeps,
  ClaimVerifier,
  VerifiedTenantClaim,
} from "./domain/tenant-claim";
export { MAX_CLAIM_LIFETIME_MS, verifyTenantClaim } from "./domain/tenant-claim";
export type { Namespace } from "./domain/namespace";
export { namespaceFor } from "./domain/namespace";
export type { Match, RetrievalFailure, ScopedQuery, VectorIndex } from "./domain/scoped-query";
export { scopedQuery } from "./domain/scoped-query";
