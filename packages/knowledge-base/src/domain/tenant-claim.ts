import { type Brand, err, ok, type Result, type TenantId } from "@custodian/domain-primitives";

/**
 * A tenant identity that has been cryptographically verified. Isolation is enforced at the query
 * layer using a signed claim carrying the tenant ID — never by instructing the model
 * (AI_Agent_Implementation_Plan_v2.txt:156).
 */
export type VerifiedTenantClaim = Brand<{ readonly tenant: TenantId }, "VerifiedTenantClaim">;

export type ClaimRejection =
  | { readonly kind: "signature-invalid" }
  | { readonly kind: "claim-malformed"; readonly received: string };

export interface ClaimVerifier {
  verify(token: string): Result<TenantId, ClaimRejection>;
}

export function verifyTenantClaim(
  token: string,
  verifier: ClaimVerifier,
): Result<VerifiedTenantClaim, ClaimRejection> {
  const verified = verifier.verify(token);
  return verified.ok ? ok({ tenant: verified.value } as VerifiedTenantClaim) : err(verified.error);
}
