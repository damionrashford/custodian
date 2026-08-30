import { expect, test } from "bun:test";
import {
  EnvelopeSubjectKeyStore,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
} from "@custodian/crypto-shred";
import {
  parseRetentionBucket,
  parseSubjectId,
  parseTenantId,
  type Namespace,
  type RetentionBucket,
  type SubjectId,
} from "@custodian/domain-primitives";
import {
  InMemoryVectorIndex,
  namespaceFor,
  sealEmbedding,
  verifyTenantClaim,
  type ClaimVerifier,
  type IndexedDocument,
} from "@custodian/knowledge-base";

const AT = new Date("2026-08-30T00:00:00.000Z");

function namespaceOf(id: string): Namespace {
  const tenant = parseTenantId(id);
  if (!tenant.ok) throw new Error("fixture: bad tenant");
  const verifier: ClaimVerifier = {
    verify: () => ({
      ok: true,
      value: {
        tenant: tenant.value,
        issuedAt: "2026-08-29T23:45:00.000Z",
        expiresAt: "2026-08-30T00:15:00.000Z",
      },
    }),
  };
  const claim = verifyTenantClaim("signed", { verifier, now: AT });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

const ACME = namespaceOf("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const OTHER = namespaceOf("t_02jd7k9h2m4n6p8r0s2t4v6x8z");

function subjectOf(value: string): SubjectId {
  const parsed = parseSubjectId(value);
  if (!parsed.ok) throw new Error("fixture: bad subject");
  return parsed.value;
}

function bucketOf(): RetentionBucket {
  const parsed = parseRetentionBucket("prompts-2026-08");
  if (!parsed.ok) throw new Error("fixture: bad bucket");
  return parsed.value;
}

const AUTHOR = subjectOf("s_01jd7k9h2m4n6p8r0s2t4v6x8z");
const OTHER_AUTHOR = subjectOf("s_02jd7k9h2m4n6p8r0s2t4v6x8z");

function keyStore(): EnvelopeSubjectKeyStore {
  return new EnvelopeSubjectKeyStore({
    custodian: new InMemoryKeyCustodian({ now: () => AT }),
    registry: new SqliteDeletionRegistry(":memory:"),
  });
}

async function seededIndex(): Promise<{
  readonly keys: EnvelopeSubjectKeyStore;
  readonly index: InMemoryVectorIndex;
}> {
  const keys = keyStore();
  const bucket = bucketOf();
  const seeds: readonly (readonly [Namespace, string, SubjectId, readonly number[]])[] = [
    [ACME, "acme-1", AUTHOR, [1, 0, 0]],
    [ACME, "acme-2", OTHER_AUTHOR, [0.9, 0.1, 0]],
    [OTHER, "other-1", OTHER_AUTHOR, [1, 0, 0]],
  ];

  const documents: IndexedDocument[] = [];
  for (const [namespace, documentId, subject, embedding] of seeds) {
    const sealed = await sealEmbedding(keys, { subject, bucket, embedding });
    if (!sealed.ok) throw new Error("fixture: seal failed");
    documents.push({ namespace, documentId, embedding: sealed.value });
  }
  return { keys, index: new InMemoryVectorIndex({ documents, keys }) };
}

test("a query never returns another namespace's documents, even at perfect similarity", async () => {
  const { index } = await seededIndex();
  const matches = await index.query({ namespace: ACME, embedding: [1, 0, 0], topK: 10 });
  if (!matches.ok) throw new Error("query failed");
  expect(matches.value.map((match) => match.documentId).sort()).toEqual(["acme-1", "acme-2"]);
});

test("topK bounds the result, best match first", async () => {
  const { index } = await seededIndex();
  const matches = await index.query({ namespace: ACME, embedding: [1, 0, 0], topK: 1 });
  if (!matches.ok) throw new Error("query failed");
  expect(matches.value.map((match) => match.documentId)).toEqual(["acme-1"]);
});

test("an empty namespace yields an empty result, not a failure", async () => {
  const empty = new InMemoryVectorIndex({ documents: [], keys: keyStore() });
  const matches = await empty.query({ namespace: ACME, embedding: [1, 0, 0], topK: 3 });
  expect(matches).toEqual({ ok: true, value: [] });
});

test("an erased subject's embedding cannot be scored against", async () => {
  const { keys, index } = await seededIndex();

  await keys.destroySubjectKey(AUTHOR);

  // Not merely "returns no match" — a soft delete would also return no match and would still leave
  // the vector on disk. The mechanism the data map names is key destruction, and this is it
  // arriving: the bytes are no longer an embedding to anyone.
  const matches = await index.query({ namespace: ACME, embedding: [1, 0, 0], topK: 10 });
  if (!matches.ok) throw new Error("query failed");
  expect(matches.value.map((match) => match.documentId)).toEqual(["acme-2"]);
});

test("erasing one subject leaves another subject's documents intact", async () => {
  const { keys, index } = await seededIndex();

  await keys.destroySubjectKey(AUTHOR);

  // Per-subject erasure, not per-tenant. A mechanism that took the whole namespace with it would
  // pass the previous test and be catastrophically wrong.
  const matches = await index.query({ namespace: OTHER, embedding: [1, 0, 0], topK: 10 });
  if (!matches.ok) throw new Error("query failed");
  expect(matches.value.map((match) => match.documentId)).toEqual(["other-1"]);
});

test("an undecryptable entry is dropped rather than retried forever", async () => {
  const { keys, index } = await seededIndex();
  expect(index.size()).toBe(3);

  await keys.destroySubjectKey(AUTHOR);
  await index.query({ namespace: ACME, embedding: [1, 0, 0], topK: 10 });

  // Dropped on read, mirroring the response cache (LD-9). An entry whose key is gone can never
  // become readable again, so keeping it means paying an unwrap on every future query to learn the
  // same thing.
  expect(index.size()).toBe(2);
});
