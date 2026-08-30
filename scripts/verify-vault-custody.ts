#!/usr/bin/env bun

/**
 * Checks the Vault-backed key custodian against a live Vault.
 *
 * NOT RUN. No `vault` binary is installed on the machine this was written on, so the HTTP wire
 * format is unverified: endpoints and payload shapes follow the published Transit API, and the
 * custodian's behaviour is tested against a fake that models Transit's semantics, but nothing here
 * has spoken to a real server. Until this script has been run and passed, do not describe the Vault
 * adapter as verified.
 *
 * This is a script rather than a test on purpose. `tests/standards.test.ts` fails the build on an
 * `http(s)://` literal anywhere under `tests/`, because a network dependency inside a blocking gate
 * is worse than no gate — one that fires at random trains people to click through red CI.
 *
 *   vault server -dev                       # in another terminal
 *   vault secrets enable transit
 *   CUSTODIAN_VAULT_ADDR=... CUSTODIAN_VAULT_TOKEN=... bun scripts/verify-vault-custody.ts
 */
import {
  EnvelopeSubjectKeyStore,
  HttpVaultTransport,
  SqliteDeletionRegistry,
  VaultTransitKeyCustodian,
} from "@custodian/custody";
import { parseRetentionBucket, parseSubjectId } from "@custodian/primitives";

function required(name: string): string {
  const value = Bun.env[name];
  if (value === undefined || value.length === 0) {
    console.error(`${name} is not set.`);
    process.exit(1);
  }
  return value;
}

function check(label: string, passed: boolean): void {
  console.log(`${passed ? "ok  " : "FAIL"}  ${label}`);
  if (!passed) {
    process.exit(1);
  }
}

const PLAINTEXT = "synthetic subject content for the custody check";

// A fresh subject each run, so a previous run's destroyed key cannot make this one pass by accident.
const subject = parseSubjectId(`s_${crypto.randomUUID().replaceAll("-", "").slice(0, 26)}`);
const bucket = parseRetentionBucket(`custody-check-${new Date().toISOString().slice(0, 7)}`);
if (!subject.ok || !bucket.ok) {
  console.error("Could not build the synthetic subject.");
  process.exit(1);
}

const store = new EnvelopeSubjectKeyStore({
  custodian: new VaultTransitKeyCustodian({
    transport: new HttpVaultTransport({
      address: required("CUSTODIAN_VAULT_ADDR"),
      token: required("CUSTODIAN_VAULT_TOKEN"),
      timeoutMs: 10_000,
    }),
    now: () => new Date(),
  }),
  registry: new SqliteDeletionRegistry(":memory:"),
});

const sealed = await store.seal({
  subject: subject.value,
  bucket: bucket.value,
  plaintext: PLAINTEXT,
});
check("seal returns sealed content", sealed.ok);
if (!sealed.ok) {
  process.exit(1);
}
check(
  "the ciphertext does not contain the plaintext",
  !sealed.value.ciphertext.includes("synthetic"),
);
check("the content key is wrapped by Vault", sealed.value.wrappedSubjectKey.startsWith("vault:"));

const opened = await store.unseal(sealed.value);
check("unseal round-trips", opened.ok && opened.value === PLAINTEXT);

const proof = await store.destroySubjectKey(subject.value);
check("destroy returns a proof", proof.ok);
if (!proof.ok) {
  process.exit(1);
}
check("the proof is externally attested", proof.value.attestation === "external");
check("the proof names the Vault key", proof.value.keyReference.startsWith("vault:transit/keys/"));

// The property the whole mechanism rests on: the ciphertext is untouched and no longer openable.
const afterErasure = await store.unseal(sealed.value);
check(
  "the ciphertext is unrecoverable after key destruction",
  !afterErasure.ok && afterErasure.error.kind === "subject-erased",
);

const repeat = await store.destroySubjectKey(subject.value);
check(
  "a repeat erasure returns the original proof",
  repeat.ok && repeat.value.recordId === proof.value.recordId,
);

console.log("\nAll custody checks passed against a live Vault.");
