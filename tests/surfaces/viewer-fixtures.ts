import { parseRunId, parseTenantId, type Namespace, type RunId } from "@custodian/primitives";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge";

export const ACME = "t_01jd7k9h2m4n6p8r0s2t4v6x8z";
export const GLOBEX = "t_02jd7k9h2m4n6p8r0s2t4v6x8z";

const NOW = new Date("2026-08-30T12:00:00.000Z");

/** Accepts a bare tenant id as its own token; the signature scheme is not what these tests exercise. */
const verifier: ClaimVerifier = {
  verify: (token) => {
    const parsed = parseTenantId(token);
    return parsed.ok
      ? {
          ok: true,
          value: {
            tenant: parsed.value,
            issuedAt: "2026-08-30T11:45:00.000Z",
            expiresAt: "2026-08-30T12:15:00.000Z",
          },
        }
      : { ok: false, error: { kind: "signature-invalid" } };
  },
};

/**
 * Goes through the real verifier and the real `namespaceFor` rather than branding a string, because
 * the property under test *is* that a namespace can only come from a verified claim. A fixture that
 * manufactures one would test the transport against a world where the guarantee does not hold.
 */
export function namespaceOf(tenant: string): Namespace {
  const claim = verifyTenantClaim(tenant, { verifier, now: NOW });
  if (!claim.ok) {
    throw new Error(`fixture: claim rejected for ${tenant}`);
  }
  return namespaceFor(claim.value);
}

function fixedRunId(suffix: string): RunId {
  const id = parseRunId(`r_${suffix}`);
  if (!id.ok) {
    throw new Error(`fixture: run id rejected: ${suffix}`);
  }
  return id.value;
}

export const RUN_A = fixedRunId("01hb7k9h2m4n6p8r0s2t4v6x8z");
export const RUN_B = fixedRunId("02hb7k9h2m4n6p8r0s2t4v6x8z");
