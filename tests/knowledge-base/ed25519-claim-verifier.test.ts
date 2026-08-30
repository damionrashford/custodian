import { expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { parseTenantId } from "@custodian/domain-primitives";
import {
  Ed25519ClaimVerifier,
  MAX_CLAIM_LIFETIME_MS,
  verifyTenantClaim,
} from "@custodian/knowledge-base";

const NOW = new Date("2026-08-30T12:00:00.000Z");

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const tenant = must(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicPem: publicKey.export({ type: "spki", format: "pem" }),
    privateKey,
  };
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

/** Mints the token an issuer would mint, so the test exercises the real wire format. */
function token(
  privateKey: ReturnType<typeof keypair>["privateKey"],
  claims: Record<string, unknown>,
  tamper?: (signed: string) => string,
): string {
  const header = base64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = base64url(sign(null, Buffer.from(`${header}.${payload}`), privateKey));
  const assembled = `${header}.${payload}.${signature}`;
  return tamper === undefined ? assembled : tamper(assembled);
}

function validClaims(lifetimeMs = 30 * 60 * 1000): Record<string, unknown> {
  return {
    tenant: String(tenant),
    iat: Math.floor(NOW.getTime() / 1000),
    exp: Math.floor((NOW.getTime() + lifetimeMs) / 1000),
  };
}

test("a token signed by the issuer verifies to its tenant", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(publicPem);
  const verified = verifyTenantClaim(token(privateKey, validClaims()), { verifier, now: NOW });
  if (!verified.ok) throw new Error(`rejected: ${verified.error.kind}`);
  expect(verified.value.tenant).toBe(tenant);
});

test("a token signed by a different key is refused", () => {
  const issuer = keypair();
  const impostor = keypair();
  const verifier = new Ed25519ClaimVerifier(issuer.publicPem);
  // The whole point of asymmetry: holding the public key does not let you mint.
  const forged = token(impostor.privateKey, validClaims());
  expect(verifyTenantClaim(forged, { verifier, now: NOW })).toEqual({
    ok: false,
    error: { kind: "signature-invalid" },
  });
});

test("editing the tenant inside a signed token breaks the signature", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(publicPem);
  const other = must(parseTenantId("t_02jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
  const swapped = token(privateKey, validClaims(), (signed) => {
    const [header, , signature] = signed.split(".");
    const payload = base64url(JSON.stringify({ ...validClaims(), tenant: String(other) }));
    return `${String(header)}.${payload}.${String(signature)}`;
  });
  expect(verifyTenantClaim(swapped, { verifier, now: NOW })).toEqual({
    ok: false,
    error: { kind: "signature-invalid" },
  });
});

test("a malformed token is refused without pretending it was a signature problem", () => {
  const { publicPem } = keypair();
  const verifier = new Ed25519ClaimVerifier(publicPem);
  for (const bad of ["", "not-a-token", "a.b", "a.b.c.d"]) {
    const rejected = verifier.verify(bad);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.error.kind).toBe("claim-malformed");
  }
});

test("a signed token whose lifetime exceeds the bound is still refused", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(publicPem);
  // A valid signature is not a licence to set any expiry: LD-7 bounds the lifetime, not just the
  // deadline, or an issuer mints a functionally unexpiring token that passes every check.
  const long = token(privateKey, validClaims(MAX_CLAIM_LIFETIME_MS + 60_000));
  const rejected = verifyTenantClaim(long, { verifier, now: NOW });
  expect(rejected.ok).toBe(false);
  if (rejected.ok) return;
  expect(rejected.error.kind).toBe("lifetime-too-long");
});

test("a signed token that has expired is refused", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(publicPem);
  const stale = token(privateKey, validClaims());
  const later = new Date(NOW.getTime() + 31 * 60 * 1000);
  const rejected = verifyTenantClaim(stale, { verifier, now: later });
  expect(rejected.ok).toBe(false);
  if (rejected.ok) return;
  expect(rejected.error.kind).toBe("expired");
});

test("a token carrying a tenant id that fails its own parser is malformed", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(publicPem);
  const bad = token(privateKey, { ...validClaims(), tenant: "NOT A TENANT" });
  const rejected = verifier.verify(bad);
  expect(rejected.ok).toBe(false);
  if (rejected.ok) return;
  expect(rejected.error.kind).toBe("claim-malformed");
});
