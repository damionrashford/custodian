import type { Result } from "@custodian/domain-primitives";
import type { RequestHash } from "./request-hash";

export type RecordedOutcome = {
  readonly status: "succeeded" | "failed";
  readonly body: string;
};

export type Claim = {
  readonly request: RequestHash;
  readonly claimedAt: string;
  readonly outcome: RecordedOutcome | undefined;
};

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
