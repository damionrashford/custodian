import { expect, test } from "bun:test";
import {
  EnvelopeSubjectKeyStore,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
} from "@custodian/custody";
import {
  parseRetentionBucket,
  parseSubjectId,
  parseTenantId,
  type Namespace,
  type SubjectId,
} from "@custodian/primitives";
import {
  namespaceFor,
  sealEmbedding,
  SqliteVectorIndex,
  verifyTenantClaim,
  type ClaimVerifier,
} from "@custodian/knowledge";

const AT = new Date("2026-08-30T00:00:00.000Z");

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

function namespaceOf(id: string): Namespace {
  const tenant = must(parseTenantId(id), "tenant");
  const verifier: ClaimVerifier = {
    verify: () => ({
      ok: true,
      value: {
        tenant,
        issuedAt: "2026-08-29T23:45:00.000Z",
        expiresAt: "2026-08-30T00:15:00.000Z",
      },
    }),
  };
  return namespaceFor(must(verifyTenantClaim("signed", { verifier, now: AT }), "claim"));
}

const ACME = namespaceOf("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const OTHER = namespaceOf("t_02jd7k9h2m4n6p8r0s2t4v6x8z");
const AUTHOR: SubjectId = must(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject");
const BUCKET = must(parseRetentionBucket("prompts-2026-08"), "bucket");

function keyStore(): EnvelopeSubjectKeyStore {
  return new EnvelopeSubjectKeyStore({
    custodian: new InMemoryKeyCustodian({ now: () => AT }),
    registry: new SqliteDeletionRegistry(":memory:"),
  });
}

function path(): string {
  return `${process.env["TMPDIR"] ?? "/tmp"}/custodian-index-${String(Bun.nanoseconds())}.sqlite`;
}

async function seed(
  index: SqliteVectorIndex,
  keys: EnvelopeSubjectKeyStore,
  entries: readonly (readonly [Namespace, string, readonly number[]])[],
): Promise<void> {
  for (const [namespace, documentId, embedding] of entries) {
    const sealed = await sealEmbedding(keys, { subject: AUTHOR, bucket: BUCKET, embedding });
    if (!sealed.ok) throw new Error("fixture: seal failed");
    index.upsert({ namespace, documentId, embedding: sealed.value });
  }
}

test("an index survives the process that wrote it", async () => {
  const keys = keyStore();
  const file = path();

  const first = new SqliteVectorIndex({ path: file, keys });
  await seed(first, keys, [[ACME, "acme-1", [1, 0, 0]]]);
  first.close();

  // The point of the table. In memory the index dies with the process while the execution log does
  // not, so a run's logged retrieval would cite a document nothing could produce again.
  const second = new SqliteVectorIndex({ path: file, keys });
  const matches = await second.query({ namespace: ACME, embedding: [1, 0, 0], topK: 4 });
  if (!matches.ok) throw new Error("query failed");
  expect(matches.value.map((match) => match.documentId)).toEqual(["acme-1"]);
  second.close();
});

test("a query never returns another namespace's documents", async () => {
  const keys = keyStore();
  const index = new SqliteVectorIndex({ path: path(), keys });
  await seed(index, keys, [
    [ACME, "acme-1", [1, 0, 0]],
    [OTHER, "other-1", [1, 0, 0]],
  ]);

  const matches = await index.query({ namespace: ACME, embedding: [1, 0, 0], topK: 10 });
  if (!matches.ok) throw new Error("query failed");
  expect(matches.value.map((match) => match.documentId)).toEqual(["acme-1"]);
  index.close();
});

test("an erased subject's embedding is unreadable and its row is dropped", async () => {
  const keys = keyStore();
  const index = new SqliteVectorIndex({ path: path(), keys });
  await seed(index, keys, [[ACME, "acme-1", [1, 0, 0]]]);

  await keys.destroySubjectKey(AUTHOR);

  // Key destruction, not a soft delete — the row goes because nothing can ever read it again,
  // which is the mechanism the data map names for this location.
  const matches = await index.query({ namespace: ACME, embedding: [1, 0, 0], topK: 4 });
  expect(matches).toEqual({ ok: true, value: [] });
  expect(index.size()).toBe(0);
  index.close();
});

test("raw bytes on disk hold no embedding", async () => {
  const keys = keyStore();
  const file = path();
  const index = new SqliteVectorIndex({ path: file, keys });
  await seed(index, keys, [[ACME, "acme-1", [0.4242424242, 0, 0]]]);
  index.close();

  // The release gate's question, asked of this store directly: is a fragment recoverable from raw
  // storage? A plaintext vector would show up here verbatim.
  expect(await Bun.file(file).text()).not.toContain("0.4242424242");
});

test("offboarding a tenant drops its namespace", async () => {
  const keys = keyStore();
  const index = new SqliteVectorIndex({ path: path(), keys });
  await seed(index, keys, [
    [ACME, "acme-1", [1, 0, 0]],
    [OTHER, "other-1", [1, 0, 0]],
  ]);

  // The data map disposes this location by namespace drop on offboarding, not by a clock.
  expect(index.dropNamespace(ACME)).toBe(1);
  expect(index.size()).toBe(1);
  index.close();
});

test("a query refuses rather than deleting rows it merely could not reach", async () => {
  const keys = keyStore();
  const file = path();
  const index = new SqliteVectorIndex({ path: file, keys });
  await seed(index, keys, [[ACME, "acme-1", [1, 0, 0]]]);
  index.close();

  const outage = {
    seal: () => Promise.reject(new Error("unused")),
    unseal: () =>
      Promise.resolve({
        ok: false as const,
        error: { kind: "custodian-unreachable" as const, detail: "vault 503" },
      }),
    destroySubjectKey: () => Promise.reject(new Error("unused")),
    expireBucket: () => Promise.reject(new Error("unused")),
  };
  const during = new SqliteVectorIndex({ path: file, keys: outage });

  // This store deletes what it cannot read, so mistaking an outage for an erasure is permanent,
  // silent data loss. The query fails instead, and the row is still there when Vault returns.
  const refused = await during.query({ namespace: ACME, embedding: [1, 0, 0], topK: 4 });
  expect(refused.ok ? "returned" : refused.error.kind).toBe("index-unavailable");
  expect(during.size()).toBe(1);
  during.close();

  const recovered = new SqliteVectorIndex({ path: file, keys });
  const matches = await recovered.query({ namespace: ACME, embedding: [1, 0, 0], topK: 4 });
  if (!matches.ok) throw new Error("query failed after recovery");
  expect(matches.value.map((match) => match.documentId)).toEqual(["acme-1"]);
  recovered.close();
});
