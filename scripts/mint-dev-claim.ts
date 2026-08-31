#!/usr/bin/env bun

/**
 * Mints a development tenant claim, the keypair that signs it, and the key ring that verifies it.
 *
 * The server never holds the private key — it verifies against a ring of public ones — so this
 * exists to make that separation usable rather than theoretical. Run it, export what it prints,
 * start the server.
 *
 *   bun scripts/mint-dev-claim.ts t_01jd7k9h2m4n6p8r0s2t4v6x8z
 *
 * To rehearse a rotation, run it twice with different key ids and merge the two rings: a verifier
 * holding both accepts claims minted under either, which is the overlap window that makes rotation
 * safe (gap-register.txt:272). Retire the old key only once the longest live claim has expired.
 */
import { generateKeyPairSync } from "node:crypto";
import { parseTenantId } from "@custodian/primitives";
import { Ed25519ClaimIssuer, MAX_CLAIM_LIFETIME_MS, parseSigningKeyId } from "@custodian/knowledge";

const requested = Bun.argv[2] ?? "t_01jd7k9h2m4n6p8r0s2t4v6x8z";
const tenant = parseTenantId(requested);
if (!tenant.ok) {
  console.error(`Not a tenant id: ${requested}`);
  process.exit(1);
}

const month = new Date().toISOString().slice(0, 7);
const kid = parseSigningKeyId(Bun.argv[4] ?? `claim-${month}`);
if (!kid.ok) {
  console.error(`Not a signing key id: ${kid.error.received}`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicPem = publicKey.export({ type: "spki", format: "pem" }).trim();

const issuer = new Ed25519ClaimIssuer({ kid: kid.value, privateKeyPem: privatePem });
const issued = issuer.issue({
  tenant: tenant.value,
  issuedAt: new Date(),
  // Half the bound, so a claim minted here cannot be the thing that trips the lifetime check.
  lifetimeMs: MAX_CLAIM_LIFETIME_MS / 2,
});
if (!issued.ok) {
  console.error(`Could not mint a claim: ${issued.error.kind}`);
  process.exit(1);
}

const ring = JSON.stringify({ [String(kid.value)]: publicPem });

// A directory rather than shell exports: sourcing generated shell is how a stray character in a key
// becomes an executed command. claim.token is a live bearer credential — short-lived, but do not
// point outDir at a tracked path. The private key is never written anywhere.
const outDir = Bun.argv[3];
if (outDir === undefined) {
  console.log(`CUSTODIAN_CLAIM_KEYS:\n${ring}\n`);
  console.log(`CUSTODIAN_DEV_CLAIM:\n${issued.value}`);
} else {
  await Bun.write(`${outDir}/claim-keys.json`, ring);
  await Bun.write(`${outDir}/claim.token`, issued.value);
  console.log(`${outDir}/claim-keys.json\n${outDir}/claim.token`);
}
console.error(
  `\nClaim for ${String(tenant.value)} under key ${String(kid.value)}, ` +
    `valid ${String(MAX_CLAIM_LIFETIME_MS / 2 / 60000)} minutes.`,
);
