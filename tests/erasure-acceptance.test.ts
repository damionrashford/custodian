import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parsePrincipalId,
  parseRegion,
  type Principal,
  type Region,
  type TenantId,
  parseModelSnapshot,
  parseProviderId,
  parsePromptVersion,
  parseRunId,
  parseSubjectId,
  parseTenantId,
} from "@custodian/primitives";
import {
  EnvelopeSubjectKeyStore,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
} from "@custodian/custody";
import { admissibleProof, DATA_MAP, runErasure } from "@custodian/custody";
import { cacheKeyFor, InMemoryResponseCache } from "@custodian/serving";
import {
  InMemoryVectorIndex,
  namespaceFor,
  sealEmbedding,
  verifyTenantClaim,
  type ClaimVerifier,
} from "@custodian/knowledge";
import { bucketFor } from "@custodian/primitives";
import {
  Sha256ContentHasher,
  subjectsIn,
  verifyRunLog,
  type LoggedEntry,
} from "@custodian/evidence";
import { serveCompletion } from "@custodian/serving";
import { parseRequestHash, SqliteIdempotencyStore } from "@custodian/serving";

function principal(tenant: TenantId): Principal {
  const id = parsePrincipalId("p_operator");
  if (!id.ok) throw new Error("fixture: bad principal");
  return { kind: "human", id: id.value, tenant };
}

function region(): Region {
  const parsed = parseRegion("eu-west-1");
  if (!parsed.ok) throw new Error("fixture: bad region");
  return parsed.value;
}

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
const hasher = new Sha256ContentHasher();

function parsedOrThrow<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

test("erasure gate: a crypto-shredded subject is unrecoverable from storage and from a pre-request backup", async () => {
  const store = new EnvelopeSubjectKeyStore({
    custodian: new InMemoryKeyCustodian({ now: () => new Date("2026-08-29T00:00:00.000Z") }),
    registry: new SqliteDeletionRegistry(":memory:"),
  });
  const subject = parsedOrThrow(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject");
  const tenant = parsedOrThrow(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
  const runId = parsedOrThrow(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");

  // The claim ledger is durable, so the gate must exercise it as one: rows written here outlive
  // the process, which is precisely the case an in-memory store cannot put under test.
  const claimsPath = join(mkdtempSync(join(tmpdir(), "custodian-gate-")), "claims.sqlite");
  const claims = new SqliteIdempotencyStore(claimsPath);

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
  const verified = verifyTenantClaim("signed", {
    verifier: claimVerifier,
    now: new Date("2026-08-29T00:00:00.000Z"),
  });
  if (!verified.ok) throw new Error("fixture: claim rejected");
  const tenantClaim = verified.value;

  // 1. Seed through the production writer, not by hand. A hand-built entry proves only that
  // appendEntry seals what it is given; it cannot catch serveCompletion sealing the wrong thing —
  // which is exactly the defect that made this gate pass vacuously while the log held the prompt
  // template instead of the request (LD-11: plant the idiomatic form).
  const provider = parsedOrThrow(parseProviderId("eu-primary"), "provider");
  const served = await serveCompletion({
    runId,
    principal: principal(tenant),
    claim: tenantClaim,
    tenantRegion: region(),
    legalBasisPolicy: "tenant-contract",
    requiresZeroRetention: true,
    prompt: {
      version: parsedOrThrow(parsePromptVersion("pv_01jd7k9h2m4n6p8r0s2t4v6x8z"), "version"),
      text: "answer the customer's question",
      model: parsedOrThrow(parseModelSnapshot("frontier-1.5-20260801"), "model"),
      parameters: { temperature: 0.2 },
      changeSource: "ticket CUS-118",
      rationale: "erasure gate fixture",
      evalPassCaret: 0.9,
      createdAt: "2026-08-29T00:00:00.000Z",
    },
    input: PERSONAL_DATA,
    maxOutputTokens: 100,
    log: [],
    requestHash: parsedOrThrow(parseRequestHash("b".repeat(64)), "hash"),
    candidates: [
      {
        id: provider,
        processingRegion: region(),
        storageRegion: region(),
        zeroRetention: true,
        healthy: true,
      },
    ],
    providers: [
      {
        id: provider,
        complete: () =>
          Promise.resolve({
            ok: true as const,
            value: { text: PERSONAL_DATA, usage: { inputTokens: 10, outputTokens: 5 } },
          }),
      },
    ],
    idempotency: claims,
    hasher,
    at: "2026-08-29T00:00:00.000Z",
    jitter: 0,
    keys: store,
    subject,
    costMicros: () => 195,
  });
  if (!served.ok) throw new Error("fixture: serveCompletion failed");
  const log: readonly LoggedEntry[] = served.value.log;

  const opening = log[0];
  if (opening?.event.kind !== "run-started") throw new Error("the writer skipped field group 1");
  const sealed = { ok: true as const, value: opening.event.request };

  // The gate is only meaningful if what the writer sealed is the personal data.
  expect(await store.unseal(sealed.value)).toEqual({ ok: true, value: PERSONAL_DATA });

  // The data map must know this entry touches the subject, or erasure would miss it.
  const first = log[0];
  if (first === undefined) throw new Error("log is empty");
  expect(subjectsIn(first.event)).toEqual([subject]);

  // 1b. The same personal data also reaches the response cache and the idempotency store. Both
  // hold SealedContent, so one key destruction has to reach all three.

  const digest = new Sha256ContentHasher();
  const cache = new InMemoryResponseCache();
  const key = cacheKeyFor(
    namespaceFor(tenantClaim),
    "frontier-1.5-20260801",
    PERSONAL_DATA,
    digest,
  );
  cache.set(key, namespaceFor(tenantClaim), sealed.value, "2026-08-29T00:00:00.000Z");

  // The cache key is a digest, so the question is not readable from the index either.
  expect(String(key)).not.toContain("jane@example.test");

  // 1c. And the vector index. The data map gives this location one erasure mechanism — "Key
  // destruction — soft delete is insufficient" (Data_Protection_and_Retention.txt:49-50) — so the
  // embedding is sealed under the same subject key rather than merely deleted. A bare vector would
  // survive the erasure, and embedding inversion makes that a recoverable fragment, not a detail.
  const embedding = [0.42, 0.17, 0.91];
  const sealedEmbedding = await sealEmbedding(store, {
    subject,
    bucket: bucketFor("prompts-and-completions", "2026-08-29T00:00:00.000Z"),
    embedding,
  });
  if (!sealedEmbedding.ok) throw new Error("fixture: sealing the embedding failed");
  const index = new InMemoryVectorIndex({
    documents: [
      {
        namespace: namespaceFor(tenantClaim),
        documentId: "jane-profile",
        embedding: sealedEmbedding.value,
      },
    ],
    keys: store,
  });

  const beforeErasure = await index.query({
    namespace: namespaceFor(tenantClaim),
    embedding,
    topK: 4,
  });
  if (!beforeErasure.ok || beforeErasure.value.length !== 1)
    throw new Error("fixture: the index did not hold the subject's document");

  // 2. Backup: a snapshot taken BEFORE the erasure request, serialised as bytes on disk would be.
  const backup = JSON.stringify(log);
  const cacheBackup = JSON.stringify(cache.get(key, "2026-08-29T00:00:00.000Z"));
  const indexBackup = JSON.stringify(sealedEmbedding.value);

  // 3. Erase — through the workflow, not by calling the key store directly, so the gate exercises
  // the identity, legal-hold and data-map steps that guard the destruction.
  const erased = await runErasure(
    {
      identity: { kind: "resolved", subject },
      receivedAt: "2026-08-29T00:00:00.000Z",
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

  // 4c-bis. Recovery attempt from the vector index. Not "the query returns nothing" — a soft delete
  // would also return nothing while leaving the vector on disk. The bytes are no longer an embedding
  // to anyone, and the index drops the entry it can no longer read.
  const afterErasure = await index.query({
    namespace: namespaceFor(tenantClaim),
    embedding,
    topK: 4,
  });
  expect(afterErasure).toEqual({ ok: true, value: [] });
  expect(index.size()).toBe(0);
  expect(await store.unseal(sealedEmbedding.value)).toEqual({
    ok: false,
    error: { kind: "subject-erased", subject },
  });
  // The pre-request snapshot of the index cannot be inverted back to the vector either.
  expect(indexBackup).not.toContain("0.42");

  // 4d. Recovery attempt from raw bytes — no fragment of the plaintext survives anywhere.
  expect(backup).not.toContain("jane@example.test");
  expect(backup).not.toContain("Jane Doe");
  expect(backup).not.toContain("4187");

  // 4e. Recovery attempt from the durable claim ledger, reopened as a restart would open it. The
  // completion is sealed under the same subject key, so destroying that key has to reach rows this
  // process did not write — the case the in-memory store could never exercise.
  claims.close();
  const reopened = new SqliteIdempotencyStore(claimsPath);
  const replayed = await reopened.claim(
    namespaceFor(tenantClaim),
    parsedOrThrow(parseRequestHash("b".repeat(64)), "hash"),
    "2026-08-29T00:00:00.000Z",
  );
  if (!replayed.ok || replayed.value.kind !== "already-claimed")
    throw new Error("the ledger lost the claim across the reopen");
  const recorded = replayed.value.claim.outcome;
  if (recorded === undefined) throw new Error("the ledger lost the outcome across the reopen");
  expect(await store.unseal(recorded.body)).toEqual({
    ok: false,
    error: { kind: "subject-erased", subject },
  });

  // And no fragment survives in the file's raw bytes either.
  expect(await Bun.file(claimsPath).text()).not.toContain("jane@example.test");
  reopened.close();

  // 5. The log is still evidence: erasure destroyed content, not integrity.
  expect(verifyRunLog(log, hasher).ok).toBe(true);

  // 5b. The gate asks what a regulator would ask: is this proof evidence, or the erasing party's
  // own account of itself? This composition self-attests, so the gate refuses it — and will keep
  // refusing until a KMS-backed store returns a record someone outside this process issued.
  expect(admissibleProof(erased.value.proof)).toEqual({
    ok: false,
    error: { kind: "self-attested", target: `subject-${String(subject)}` },
  });

  // 6. Erasure is idempotent — a repeat request returns the original proof.
  expect(await store.destroySubjectKey(subject)).toEqual(proof);
});
