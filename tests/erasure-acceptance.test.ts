import { expect, test } from "bun:test";
import { parseRetentionBucket, parseSubjectId, parseTenantId } from "@custodian/domain-primitives";
import { AesGcmSubjectKeyStore } from "@custodian/crypto-shred";
import { DATA_MAP, runErasure } from "@custodian/erasure";
import { cacheKeyFor, InMemoryResponseCache, Sha256KeyDigest } from "@custodian/response-cache";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge-base";
import {
  appendEntry,
  parseRunId,
  Sha256EntryHasher,
  subjectsIn,
  verifyRunLog,
  type LoggedEntry,
} from "@custodian/execution-log";

/**
 * The release gate from Data_Protection_and_Retention.txt:112-113. Create a synthetic data subject,
 * exercise the pipeline until the subject appears in every storage layer, issue an erasure request,
 * then attempt recovery from raw storage, from every cache, and from a backup taken before the
 * request. Any recovered fragment fails the gate.
 *
 * Each later stage extends this file with its own storage layer — vector index, semantic cache,
 * agent memory — rather than writing a new test.
 */
const PERSONAL_DATA = "Jane Doe, jane@example.test, account 4187";
const hasher = new Sha256EntryHasher();

function parsedOrThrow<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

test("erasure gate: a crypto-shredded subject is unrecoverable from storage and from a pre-request backup", async () => {
  const store = new AesGcmSubjectKeyStore({ now: () => new Date("2026-08-29T00:00:00.000Z") });
  const subject = parsedOrThrow(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject");
  const bucket = parsedOrThrow(parseRetentionBucket("content-2026-08"), "bucket");
  const tenant = parsedOrThrow(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
  const runId = parsedOrThrow(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");

  // 1. Seed: the subject's personal data reaches the execution log.
  const sealed = await store.seal({ subject, bucket, plaintext: PERSONAL_DATA });
  if (!sealed.ok) throw new Error("seal failed");

  const appended = appendEntry(
    [],
    {
      kind: "run-started",
      principal: "p_operator",
      tenant,
      region: "eu-west-1",
      legalBasisPolicy: "tenant-contract",
      request: sealed.value,
    },
    { runId, at: "2026-08-29T00:00:00.000Z", hasher },
  );
  if (!appended.ok) throw new Error("append failed");
  const log: readonly LoggedEntry[] = appended.value;

  // The data map must know this entry touches the subject, or erasure would miss it.
  const first = log[0];
  if (first === undefined) throw new Error("log is empty");
  expect(subjectsIn(first.event)).toEqual([subject]);

  // 1b. The same personal data also reaches the response cache and the idempotency store. Both
  // hold SealedContent, so one key destruction has to reach all three.
  const claimVerifier: ClaimVerifier = {
    verify: () => ({
      ok: true,
      value: {
        tenant,
        issuedAt: "2026-08-28T23:45:00.000Z",
        expiresAt: "2026-08-29T00:15:00.000Z",
      },
    }),
  };
  const claim = verifyTenantClaim("signed", {
    verifier: claimVerifier,
    now: new Date("2026-08-29T00:00:00.000Z"),
  });
  if (!claim.ok) throw new Error("fixture: claim rejected");

  const digest = new Sha256KeyDigest();
  const cache = new InMemoryResponseCache();
  const key = cacheKeyFor(
    namespaceFor(claim.value),
    "frontier-1.5-20260801",
    PERSONAL_DATA,
    digest,
  );
  cache.set(key, namespaceFor(claim.value), sealed.value, "2026-08-29T00:00:00.000Z");

  // The cache key is a digest, so the question is not readable from the index either.
  expect(String(key)).not.toContain("jane@example.test");

  // 2. Backup: a snapshot taken BEFORE the erasure request, serialised as bytes on disk would be.
  const backup = JSON.stringify(log);
  const cacheBackup = JSON.stringify(cache.get(key, "2026-08-29T00:00:00.000Z"));

  // 3. Erase — through the workflow, not by calling the key store directly, so the gate exercises
  // the identity, legal-hold and data-map steps that guard the destruction.
  const erased = await runErasure(
    {
      subject,
      receivedAt: "2026-08-29T00:00:00.000Z",
      identityAmbiguous: false,
      legalHold: undefined,
      coveredLocations: DATA_MAP,
    },
    store,
  );
  if (!erased.ok || erased.value.kind !== "erased")
    throw new Error("erasure workflow did not erase");
  const proof = { ok: true as const, value: erased.value.proof };
  expect(erased.value.invalidated).toEqual(DATA_MAP);

  // 4a. Recovery attempt from live storage.
  expect(await store.unseal(sealed.value)).toEqual({
    ok: false,
    error: { kind: "subject-erased", subject },
  });

  // 4b. Recovery attempt from the pre-request backup — the restored ciphertext has no key.
  const restored: readonly LoggedEntry[] = JSON.parse(backup) as readonly LoggedEntry[];
  const restoredFirst = restored[0];
  if (restoredFirst?.event.kind !== "run-started") throw new Error("restore lost the entry");
  expect(await store.unseal(restoredFirst.event.request)).toEqual({
    ok: false,
    error: { kind: "subject-erased", subject },
  });

  // 4c. Recovery attempt from the response cache — the same destroyed key covers it.
  const cached = cache.get(key, "2026-08-29T00:00:00.000Z");
  if (cached === undefined) throw new Error("cache lost the entry");
  expect(await store.unseal(cached)).toEqual({
    ok: false,
    error: { kind: "subject-erased", subject },
  });
  expect(cacheBackup).not.toContain("jane@example.test");

  // 4d. Recovery attempt from raw bytes — no fragment of the plaintext survives anywhere.
  expect(backup).not.toContain("jane@example.test");
  expect(backup).not.toContain("Jane Doe");
  expect(backup).not.toContain("4187");

  // 5. The log is still evidence: erasure destroyed content, not integrity.
  expect(verifyRunLog(log, hasher).ok).toBe(true);

  // 6. Erasure is idempotent — a repeat request returns the original proof.
  expect(await store.destroySubjectKey(subject)).toEqual(proof);
});
