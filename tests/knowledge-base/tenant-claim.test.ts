import { expect, test } from "bun:test";
import { parseTenantId } from "@custodian/domain-primitives";
import {
  MAX_CLAIM_LIFETIME_MS,
  verifyTenantClaim,
  type ClaimContents,
  type ClaimVerifier,
} from "@custodian/knowledge-base";

const ACME = "t_01jd7k9h2m4n6p8r0s2t4v6x8z";
const NOW = new Date("2026-08-29T12:00:00.000Z");

function tenant(value: string) {
  const parsed = parseTenantId(value);
  if (!parsed.ok) throw new Error(`fixture: bad tenant ${value}`);
  return parsed.value;
}

/** A verifier that trusts any token shaped `signed:<issuedAt>:<expiresAt>`. */
function verifierFor(contents: ClaimContents): ClaimVerifier {
  return {
    verify: (token) =>
      token.startsWith("signed:")
        ? { ok: true, value: contents }
        : { ok: false, error: { kind: "signature-invalid" } },
  };
}

function contents(overrides: Partial<ClaimContents> = {}): ClaimContents {
  return {
    tenant: tenant(ACME),
    issuedAt: "2026-08-29T11:30:00.000Z",
    expiresAt: "2026-08-29T12:30:00.000Z",
    ...overrides,
  };
}

function verify(claim: ClaimContents, token = "signed:x") {
  return verifyTenantClaim(token, { verifier: verifierFor(claim), now: NOW });
}

test("a signed, unexpired, short-lived claim verifies", () => {
  const result = verify(contents());
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.tenant).toBe(tenant(ACME));
});

test("an unsigned token is rejected", () => {
  expect(verify(contents(), "forged:x")).toEqual({
    ok: false,
    error: { kind: "signature-invalid" },
  });
});

test("an expired claim is rejected even though its signature is valid", () => {
  expect(verify(contents({ expiresAt: "2026-08-29T11:59:59.000Z" }))).toEqual({
    ok: false,
    error: { kind: "expired", expiresAt: "2026-08-29T11:59:59.000Z" },
  });
});

test("a claim expiring exactly now is rejected, not accepted on the boundary", () => {
  expect(verify(contents({ expiresAt: NOW.toISOString() })).ok).toBe(false);
});

test("a claim issued in the future is rejected rather than treated as fresh", () => {
  expect(verify(contents({ issuedAt: "2026-08-29T12:00:01.000Z" }))).toEqual({
    ok: false,
    error: { kind: "not-yet-valid", issuedAt: "2026-08-29T12:00:01.000Z" },
  });
});

test("an over-long lifetime is refused — checking expiry alone would not catch it", () => {
  // Issued now, expiring in ten years. It passes an expiry check and is functionally an
  // unexpiring token, which is exactly what bounding the lifetime prevents.
  const forever = contents({
    issuedAt: "2026-08-29T11:59:00.000Z",
    expiresAt: "2036-08-29T11:59:00.000Z",
  });
  const result = verify(forever);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("lifetime-too-long");
});

test("a lifetime exactly at the cap is allowed", () => {
  const issued = new Date(NOW.getTime() - 1_000);
  const atCap = contents({
    issuedAt: issued.toISOString(),
    expiresAt: new Date(issued.getTime() + MAX_CLAIM_LIFETIME_MS).toISOString(),
  });
  expect(verify(atCap).ok).toBe(true);
});

test("an unparseable timestamp is malformed, not silently treated as zero", () => {
  const result = verify(contents({ expiresAt: "whenever" }));
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("claim-malformed");
});

test("the verified claim carries its expiry, so downstream can reason about staleness", () => {
  const result = verify(contents());
  if (!result.ok) throw new Error("expected a verified claim");
  expect(result.value.expiresAt).toBe("2026-08-29T12:30:00.000Z");
});
