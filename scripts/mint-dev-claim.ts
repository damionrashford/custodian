#!/usr/bin/env bun

/**
 * Mints a development tenant claim and the keypair that verifies it.
 *
 * The server never holds the private key — it verifies with the public one — so this exists to make
 * that separation usable rather than theoretical. Run it, export what it prints, start the server.
 *
 *   bun scripts/mint-dev-claim.ts t_01jd7k9h2m4n6p8r0s2t4v6x8z
 */
import { generateKeyPairSync, sign } from "node:crypto";
import { parseTenantId } from "@custodian/primitives";
import { MAX_CLAIM_LIFETIME_MS } from "@custodian/knowledge";

const requested = Bun.argv[2] ?? "t_01jd7k9h2m4n6p8r0s2t4v6x8z";
const tenant = parseTenantId(requested);
if (!tenant.ok) {
  console.error(`Not a tenant id: ${requested}`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const now = Date.now();
const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT" })).toString("base64url");
const payload = Buffer.from(
  JSON.stringify({
    tenant: String(tenant.value),
    iat: Math.floor(now / 1000),
    // Half the bound, so a claim minted here cannot be the thing that trips the lifetime check.
    exp: Math.floor((now + MAX_CLAIM_LIFETIME_MS / 2) / 1000),
  }),
).toString("base64url");
const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");

const pem = publicKey.export({ type: "spki", format: "pem" }).trim();
const token = `${header}.${payload}.${signature}`;

// A directory rather than shell exports: sourcing generated shell is how a stray character in a
// key becomes an executed command. claim.token is a live bearer credential — short-lived, but do
// not point outDir at a tracked path. The private key is never written anywhere.
const outDir = Bun.argv[3];
if (outDir === undefined) {
  console.log(`CUSTODIAN_CLAIM_PUBLIC_KEY (PEM):\n${pem}\n`);
  console.log(`CUSTODIAN_DEV_CLAIM:\n${token}`);
} else {
  await Bun.write(`${outDir}/claim.pub`, pem);
  await Bun.write(`${outDir}/claim.token`, token);
  console.log(`${outDir}/claim.pub\n${outDir}/claim.token`);
}
console.error(
  `\nClaim for ${String(tenant.value)}, valid ${String(MAX_CLAIM_LIFETIME_MS / 2 / 60000)} minutes.`,
);
