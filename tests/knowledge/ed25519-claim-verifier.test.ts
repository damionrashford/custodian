import { expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { parseTenantId } from "@custodian/primitives";
import {
  Ed25519ClaimIssuer,
  Ed25519ClaimVerifier,
  MAX_CLAIM_LIFETIME_MS,
  parseSigningKeyId,
  verifyTenantClaim,
  type SigningKeyId,
} from "@custodian/knowledge";

const NOW = new Date("2026-08-30T12:00:00.000Z");

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const tenant = must(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");

const ACTIVE = must(parseSigningKeyId("claim-2026-08"), "kid");
const NEXT = must(parseSigningKeyId("claim-2026-09"), "kid");

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicPem: publicKey.export({ type: "spki", format: "pem" }),
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    privateKey,
  };
}

/** A ring holding one key, which is the ordinary steady state between rotations. */
function ring(publicPem: string, kid: SigningKeyId = ACTIVE): ReadonlyMap<SigningKeyId, string> {
  return new Map([[kid, publicPem]]);
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

/** Mints the token an issuer would mint, so the test exercises the real wire format. */
function token(
  privateKey: ReturnType<typeof keypair>["privateKey"],
  claims: Record<string, unknown>,
  tamper?: (signed: string) => string,
  kid: SigningKeyId = ACTIVE,
): string {
  const header = base64url(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: String(kid) }));
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
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));
  const verified = verifyTenantClaim(token(privateKey, validClaims()), { verifier, now: NOW });
  if (!verified.ok) throw new Error(`rejected: ${verified.error.kind}`);
  expect(verified.value.tenant).toBe(tenant);
});

test("a token signed by a different key is refused", () => {
  const issuer = keypair();
  const impostor = keypair();
  const verifier = new Ed25519ClaimVerifier(ring(issuer.publicPem));
  // The whole point of asymmetry: holding the public key does not let you mint.
  const forged = token(impostor.privateKey, validClaims());
  expect(verifyTenantClaim(forged, { verifier, now: NOW })).toEqual({
    ok: false,
    error: { kind: "signature-invalid" },
  });
});

test("editing the tenant inside a signed token breaks the signature", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));
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
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));
  for (const bad of ["", "not-a-token", "a.b", "a.b.c.d"]) {
    const rejected = verifier.verify(bad);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.error.kind).toBe("claim-malformed");
  }
});

test("a signed token whose lifetime exceeds the bound is still refused", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));
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
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));
  const stale = token(privateKey, validClaims());
  const later = new Date(NOW.getTime() + 31 * 60 * 1000);
  const rejected = verifyTenantClaim(stale, { verifier, now: later });
  expect(rejected.ok).toBe(false);
  if (rejected.ok) return;
  expect(rejected.error.kind).toBe("expired");
});

test("a token carrying a tenant id that fails its own parser is malformed", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));
  const bad = token(privateKey, { ...validClaims(), tenant: "NOT A TENANT" });
  const rejected = verifier.verify(bad);
  expect(rejected.ok).toBe(false);
  if (rejected.ok) return;
  expect(rejected.error.kind).toBe("claim-malformed");
});

test("the issuer mints a claim the verifier accepts", () => {
  const { publicPem, privatePem } = keypair();
  const issuer = new Ed25519ClaimIssuer({ kid: ACTIVE, privateKeyPem: privatePem });
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));

  const issued = issuer.issue({ tenant, issuedAt: NOW, lifetimeMs: 30 * 60 * 1000 });
  if (!issued.ok) throw new Error(`issuance failed: ${issued.error.kind}`);

  const verified = verifyTenantClaim(issued.value, { verifier, now: NOW });
  if (!verified.ok) throw new Error(`rejected: ${verified.error.kind}`);
  expect(verified.value.tenant).toBe(tenant);
});

test("the issuer refuses to mint beyond the lifetime bound", () => {
  const { privatePem } = keypair();
  const issuer = new Ed25519ClaimIssuer({ kid: ACTIVE, privateKeyPem: privatePem });

  // The verifier's bound protects against a hostile issuer and is the one that cannot be removed.
  // This one catches our own mistake at the line that made it, rather than at every consumer.
  const issued = issuer.issue({
    tenant,
    issuedAt: NOW,
    lifetimeMs: MAX_CLAIM_LIFETIME_MS + 60_000,
  });
  expect(issued.ok ? "issued" : issued.error.kind).toBe("lifetime-too-long");
});

test("a ring holding both keys accepts claims minted under either, which is what makes rotation safe", () => {
  const outgoing = keypair();
  const incoming = keypair();
  const overlap = new Map([
    [ACTIVE, outgoing.publicPem],
    [NEXT, incoming.publicPem],
  ]);
  const verifier = new Ed25519ClaimVerifier(overlap);

  // The dual-credential window: "accept both keys during the overlap window, and only then retire
  // the old one" (Gap_Register_v2.txt:272). Without it, rotating invalidates every claim in flight.
  for (const [kid, pair] of [
    [ACTIVE, outgoing],
    [NEXT, incoming],
  ] as const) {
    const minted = new Ed25519ClaimIssuer({ kid, privateKeyPem: pair.privatePem }).issue({
      tenant,
      issuedAt: NOW,
      lifetimeMs: 30 * 60 * 1000,
    });
    if (!minted.ok) throw new Error("issuance failed");
    expect(verifyTenantClaim(minted.value, { verifier, now: NOW }).ok).toBe(true);
  }
});

test("a claim under a retired key is refused once that key leaves the ring", () => {
  const retired = keypair();
  const current = keypair();
  const minted = new Ed25519ClaimIssuer({ kid: ACTIVE, privateKeyPem: retired.privatePem }).issue({
    tenant,
    issuedAt: NOW,
    lifetimeMs: 30 * 60 * 1000,
  });
  if (!minted.ok) throw new Error("issuance failed");

  // Retirement is the third step, and this is what it buys: the old key stops being accepted.
  const afterRetirement = new Ed25519ClaimVerifier(ring(current.publicPem, NEXT));
  const rejected = verifyTenantClaim(minted.value, { verifier: afterRetirement, now: NOW });
  expect(rejected.ok ? "accepted" : rejected.error.kind).toBe("unknown-signing-key");
});

test("a token naming an algorithm this platform does not sign with is refused before any key is chosen", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));
  const payload = base64url(JSON.stringify(validClaims()));

  // Algorithm confusion is the oldest JWT attack there is. The signature check would reject this
  // anyway today — the point is that it is refused on its own terms, so the guarantee does not
  // quietly depend on which crypto library is underneath.
  for (const alg of ["none", "HS256", "RS256"]) {
    const header = base64url(JSON.stringify({ alg, typ: "JWT", kid: String(ACTIVE) }));
    const signature = base64url(sign(null, Buffer.from(`${header}.${payload}`), privateKey));
    const rejected = verifier.verify(`${header}.${payload}.${signature}`);
    expect(rejected.ok ? "accepted" : rejected.error.kind).toBe("wrong-algorithm");
  }
});

test("a token naming a key the ring does not hold never reaches signature verification", () => {
  const { publicPem, privateKey } = keypair();
  const verifier = new Ed25519ClaimVerifier(ring(publicPem));

  // `kid` is attacker-controlled, so it may only select among keys an operator configured. An
  // unknown one is refused rather than falling back to "try them all", which would make the ring
  // an any-of check and the retirement step meaningless.
  const stranger = token(privateKey, validClaims(), undefined, NEXT);
  const rejected = verifier.verify(stranger);
  expect(rejected.ok ? "accepted" : rejected.error.kind).toBe("unknown-signing-key");
});

test("an empty key ring is refused at construction, not at the first query", () => {
  // A ring with no keys rejects every claim, which reads in production as a total tenant outage
  // with a per-request error. Failing at composition names the real problem once.
  expect(() => new Ed25519ClaimVerifier(new Map())).toThrow("key ring is empty");
});
