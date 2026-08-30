import { brand, type Brand, err, ok, type Result, type TenantId } from "@custodian/primitives";

/**
 * A tenant identity that has been cryptographically verified AND is currently valid. Isolation is
 * enforced at the query layer using a signed claim carrying the tenant ID — never by instructing the
 * model (AI_Agent_Implementation_Plan_v2.txt:156).
 *
 * Any retrieval returning another tenant's namespace pages and is treated as a breach until
 * disproven (Reliability_and_Operations.txt:84-86), so this is the highest-stakes boundary in the
 * platform and it is verified accordingly.
 */
export type VerifiedTenantClaim = Brand<
  { readonly tenant: TenantId; readonly expiresAt: string },
  "VerifiedTenantClaim"
>;

/** What a verifier extracts from a token before this module decides whether to trust it. */
export type ClaimContents = {
  readonly tenant: TenantId;
  readonly issuedAt: string;
  readonly expiresAt: string;
};

export type ClaimRejection =
  | { readonly kind: "signature-invalid" }
  | { readonly kind: "claim-malformed"; readonly received: string }
  | { readonly kind: "expired"; readonly expiresAt: string }
  | { readonly kind: "not-yet-valid"; readonly issuedAt: string }
  | { readonly kind: "lifetime-too-long"; readonly lifetimeMs: number; readonly maxMs: number };

export interface ClaimVerifier {
  verify(token: string): Result<ClaimContents, ClaimRejection>;
}

/**
 * One hour, deliberately longer than the five-minute agent-card window. The two boundaries take
 * different controls because they have different shapes:
 *
 * - An agent card is presented once per handoff, so a nonce ledger is the right replay defence and
 *   a short window costs nothing.
 * - A tenant claim is a bearer credential replayed on *every* query by design, so a nonce ledger
 *   would reject legitimate reuse. Bounded lifetime is the control that fits.
 *
 * Copying the card's controls here would have broken normal operation; copying none of them left
 * a captured token valid forever.
 */
export const MAX_CLAIM_LIFETIME_MS = 60 * 60 * 1000;

export type ClaimVerificationDeps = {
  readonly verifier: ClaimVerifier;
  readonly now: Date;
};

/**
 * Checking `expiresAt` alone is not enough. An issuer that can set expiry arbitrarily far out
 * defeats the control entirely — a token minted with a ten-year lifetime passes an expiry check and
 * is functionally the unexpiring token this exists to prevent. So the *lifetime* is bounded, not
 * just the deadline.
 */
export function verifyTenantClaim(
  token: string,
  deps: ClaimVerificationDeps,
): Result<VerifiedTenantClaim, ClaimRejection> {
  const verified = deps.verifier.verify(token);
  if (!verified.ok) {
    return err(verified.error);
  }

  const { tenant, issuedAt, expiresAt } = verified.value;
  const issued = Date.parse(issuedAt);
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(issued) || Number.isNaN(expires)) {
    return err({ kind: "claim-malformed", received: `${issuedAt}..${expiresAt}` });
  }

  const nowMs = deps.now.getTime();
  if (issued > nowMs) {
    return err({ kind: "not-yet-valid", issuedAt });
  }
  if (expires <= nowMs) {
    return err({ kind: "expired", expiresAt });
  }

  const lifetimeMs = expires - issued;
  if (lifetimeMs > MAX_CLAIM_LIFETIME_MS) {
    return err({ kind: "lifetime-too-long", lifetimeMs, maxMs: MAX_CLAIM_LIFETIME_MS });
  }

  return ok(
    brand<VerifiedTenantClaim, { readonly tenant: TenantId; readonly expiresAt: string }>({
      tenant,
      expiresAt,
    }),
  );
}
