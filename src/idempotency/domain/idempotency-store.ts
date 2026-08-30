import type { Namespace, Result, SealedContent } from "@custodian/domain-primitives";
import type { RequestHash } from "./request-hash";

/**
 * The recorded body is SealedContent, never plaintext. A completion is personal data, and an
 * idempotency store that holds it in the clear is a location the erasure workflow cannot reach -
 * which the spec calls a defect outright: any location not in the data map is a defect, logged as
 * such (Data_Protection_and_Retention.txt:92-93).
 */
export type RecordedOutcome = {
  readonly status: "succeeded" | "failed";
  readonly body: SealedContent;
};

export type Claim = {
  readonly namespace: Namespace;
  readonly request: RequestHash;
  readonly claimedAt: string;
  readonly expiresAt: string;
  readonly outcome: RecordedOutcome | undefined;
};

/**
 * Twenty-four hours. A claim without a TTL is two bugs at once: the store grows without bound, and
 * a legitimately identical request months later is silently deduplicated and never executed - the
 * caller receives a stale answer for work that never ran.
 */
export const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyFailure =
  | { readonly kind: "in-flight"; readonly request: RequestHash }
  | { readonly kind: "unknown-claim"; readonly request: RequestHash };

export type ClaimResult =
  | { readonly kind: "claimed"; readonly claim: Claim }
  | { readonly kind: "already-claimed"; readonly claim: Claim };

/**
 * Every operation is scoped by namespace, which can only be derived from a verified tenant claim
 * (@custodian/knowledge-base `namespaceFor`). A store keyed by request hash alone leaves whether
 * the tenant is inside the hash as the caller's undocumented responsibility: two tenants whose
 * requests hash alike share one claim, and the second is told its work was already done. The
 * response cache reached this shape first (`ResponseCache.set`); this is the same rule.
 */
export interface IdempotencyStore {
  claim(
    namespace: Namespace,
    request: RequestHash,
    at: string,
  ): Promise<Result<ClaimResult, IdempotencyFailure>>;
  complete(
    namespace: Namespace,
    request: RequestHash,
    outcome: RecordedOutcome,
  ): Promise<Result<Claim, IdempotencyFailure>>;
}

export function isExpired(claim: Claim, at: string): boolean {
  return Date.parse(at) >= Date.parse(claim.expiresAt);
}
