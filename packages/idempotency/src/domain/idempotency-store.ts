import type { Result, SealedContent } from "@custodian/domain-primitives";
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

export interface IdempotencyStore {
  claim(request: RequestHash, at: string): Promise<Result<ClaimResult, IdempotencyFailure>>;
  complete(
    request: RequestHash,
    outcome: RecordedOutcome,
  ): Promise<Result<Claim, IdempotencyFailure>>;
}

export function isExpired(claim: Claim, at: string): boolean {
  return Date.parse(at) >= Date.parse(claim.expiresAt);
}
