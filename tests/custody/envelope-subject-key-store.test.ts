import { expect, test } from "bun:test";
import {
  EnvelopeSubjectKeyStore,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
  bucketKeyName,
  subjectKeyName,
} from "@custodian/custody";
import {
  parseRetentionBucket,
  parseSubjectId,
  type RetentionBucket,
  type SubjectId,
} from "@custodian/primitives";

const SUBJECT = "s_01jd7k9h2m4n6p8r0s2t4v6x8z";
const BUCKET = "prompts-2026-08";
const AT = "2026-08-30T00:00:00.000Z";
const OUTAGE = { kind: "custodian-unreachable", detail: "vault 503" } as const;

function fixtures(): {
  readonly store: EnvelopeSubjectKeyStore;
  readonly subject: SubjectId;
  readonly bucket: RetentionBucket;
} {
  const subject = parseSubjectId(SUBJECT);
  const bucket = parseRetentionBucket(BUCKET);
  if (!subject.ok || !bucket.ok) {
    throw new Error("fixture did not parse");
  }
  return {
    store: new EnvelopeSubjectKeyStore({
      custodian: new InMemoryKeyCustodian({ now: () => new Date(AT) }),
      registry: new SqliteDeletionRegistry(":memory:"),
    }),
    subject: subject.value,
    bucket: bucket.value,
  };
}

test("a subject and a bucket cannot collide on one custody key name", () => {
  const { subject, bucket } = fixtures();

  // Two namespaces in one Transit mount. Without the prefix, a bucket named for a subject id would
  // address that subject's key-encryption key, and expiring the bucket — scheduled and unattended —
  // would perform an Article 17 erasure nobody requested.
  expect(String(subjectKeyName(subject))).toBe(`subject-${SUBJECT}`);
  expect(String(bucketKeyName(bucket))).toBe(`bucket-${BUCKET}`);
});

test("sealed content round-trips", async () => {
  const { store, subject, bucket } = fixtures();
  const sealed = await store.seal({ subject, bucket, plaintext: "the quick brown fox" });
  if (!sealed.ok) {
    throw new Error("seal failed");
  }

  expect(sealed.value.ciphertext).not.toContain("quick");
  expect(await store.unseal(sealed.value)).toEqual({ ok: true, value: "the quick brown fox" });
});

test("destroying the subject key makes the ciphertext unrecoverable", async () => {
  const { store, subject, bucket } = fixtures();
  const sealed = await store.seal({ subject, bucket, plaintext: "personal data" });
  if (!sealed.ok) {
    throw new Error("seal failed");
  }

  await store.destroySubjectKey(subject);

  const opened = await store.unseal(sealed.value);
  expect(opened.ok ? "opened" : opened.error.kind).toBe("subject-erased");
});

test("expiring the bucket is reported as retention, not as erasure", async () => {
  const { store, subject, bucket } = fixtures();
  const sealed = await store.seal({ subject, bucket, plaintext: "personal data" });
  if (!sealed.ok) {
    throw new Error("seal failed");
  }

  await store.expireBucket(bucket);

  // Two independent keys, and the failure kind is how a caller tells the two apart. Reporting this
  // as subject-erased would say a person had been erased when a retention period had merely run.
  const opened = await store.unseal(sealed.value);
  expect(opened.ok ? "opened" : opened.error.kind).toBe("bucket-expired");
});

test("a repeat erasure returns the original proof", async () => {
  const { store, subject } = fixtures();

  const first = await store.destroySubjectKey(subject);
  const second = await store.destroySubjectKey(subject);

  // "Idempotent; a repeat request is a no-op returning the original proof"
  // (Data_Protection_and_Retention.txt:95-96). A fresh proof would be a second audit record of a
  // single destruction, carrying a timestamp the destruction did not happen at.
  expect(second).toEqual(first);
});

test("the in-memory custodian does not claim external attestation", async () => {
  const { store, subject } = fixtures();

  const proof = await store.destroySubjectKey(subject);
  if (!proof.ok) {
    throw new Error("destroy failed");
  }

  // The process that destroyed the key is the one writing the record of it. Naming that is what
  // stops the release gate passing against a proof with no independent custodian behind it.
  expect(proof.value.attestation).toBe("self");
});

test("an unreachable custodian is not translated into an erasure", async () => {
  const { subject, bucket } = fixtures();
  const reachable = new InMemoryKeyCustodian({ now: () => new Date(AT) });
  const sealed = await new EnvelopeSubjectKeyStore({
    custodian: reachable,
    registry: new SqliteDeletionRegistry(":memory:"),
  }).seal({ subject, bucket, plaintext: "personal data" });
  if (!sealed.ok) {
    throw new Error("seal failed");
  }

  const unreachable = new EnvelopeSubjectKeyStore({
    custodian: {
      issueDataKey: () => Promise.resolve({ ok: false as const, error: OUTAGE }),
      unwrapDataKey: () => Promise.resolve({ ok: false as const, error: OUTAGE }),
      destroyKey: () => Promise.resolve({ ok: false as const, error: OUTAGE }),
    },
    registry: new SqliteDeletionRegistry(":memory:"),
  });

  // Flattening this into subject-erased would undo the custodian's work of separating an
  // infrastructure fault from a destroyed key, and the vector index deletes what it cannot unseal.
  const opened = await unreachable.unseal(sealed.value);
  expect(opened.ok ? "opened" : opened.error.kind).toBe("custodian-unreachable");
});
