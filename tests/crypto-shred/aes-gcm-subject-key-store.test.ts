import { expect, test } from "bun:test";
import { parseRetentionBucket, parseSubjectId } from "@custodian/domain-primitives";
import { AesGcmSubjectKeyStore } from "@custodian/crypto-shred";

const SUBJECT = "s_01jd7k9h2m4n6p8r0s2t4v6x8z";
const OTHER_SUBJECT = "s_02jd7k9h2m4n6p8r0s2t4v6x8z";
const BUCKET = "content-2026-08";
const SECRET = "Jane Doe, jane@example.test, account 4187";

function subject(value: string) {
  const parsed = parseSubjectId(value);
  if (!parsed.ok) throw new Error(`fixture: ${value} is not a subject id`);
  return parsed.value;
}

function bucket(value: string) {
  const parsed = parseRetentionBucket(value);
  if (!parsed.ok) throw new Error(`fixture: ${value} is not a retention bucket`);
  return parsed.value;
}

function newStore() {
  return new AesGcmSubjectKeyStore({ now: () => new Date("2026-08-29T00:00:00.000Z") });
}

test("sealed content round-trips", async () => {
  const store = newStore();
  const sealed = await store.seal({
    subject: subject(SUBJECT),
    bucket: bucket(BUCKET),
    plaintext: SECRET,
  });
  expect(sealed.ok).toBe(true);
  if (!sealed.ok) return;

  const unsealed = await store.unseal(sealed.value);
  expect(unsealed).toEqual({ ok: true, value: SECRET });
});

test("the ciphertext does not contain the plaintext", async () => {
  const store = newStore();
  const sealed = await store.seal({
    subject: subject(SUBJECT),
    bucket: bucket(BUCKET),
    plaintext: SECRET,
  });
  if (!sealed.ok) throw new Error("seal failed");

  expect(sealed.value.ciphertext).not.toContain("jane@example.test");
  expect(atob(sealed.value.ciphertext)).not.toContain("jane@example.test");
});

test("destroying the subject key makes existing ciphertext unrecoverable", async () => {
  const store = newStore();
  const sealed = await store.seal({
    subject: subject(SUBJECT),
    bucket: bucket(BUCKET),
    plaintext: SECRET,
  });
  if (!sealed.ok) throw new Error("seal failed");

  await store.destroySubjectKey(subject(SUBJECT));

  expect(await store.unseal(sealed.value)).toEqual({
    ok: false,
    error: { kind: "subject-erased", subject: subject(SUBJECT) },
  });
});

test("destroying a subject key is idempotent and returns the original proof", async () => {
  const store = newStore();
  await store.seal({ subject: subject(SUBJECT), bucket: bucket(BUCKET), plaintext: SECRET });

  const first = await store.destroySubjectKey(subject(SUBJECT));
  const second = await store.destroySubjectKey(subject(SUBJECT));

  expect(second).toEqual(first);
});

test("erasing one subject leaves another subject readable", async () => {
  const store = newStore();
  const mine = await store.seal({
    subject: subject(SUBJECT),
    bucket: bucket(BUCKET),
    plaintext: SECRET,
  });
  const theirs = await store.seal({
    subject: subject(OTHER_SUBJECT),
    bucket: bucket(BUCKET),
    plaintext: "unrelated",
  });
  if (!mine.ok || !theirs.ok) throw new Error("seal failed");

  await store.destroySubjectKey(subject(SUBJECT));

  expect(await store.unseal(theirs.value)).toEqual({ ok: true, value: "unrelated" });
});

test("expiring the retention bucket also makes content unrecoverable", async () => {
  const store = newStore();
  const sealed = await store.seal({
    subject: subject(SUBJECT),
    bucket: bucket(BUCKET),
    plaintext: SECRET,
  });
  if (!sealed.ok) throw new Error("seal failed");

  await store.expireBucket(bucket(BUCKET));

  expect(await store.unseal(sealed.value)).toEqual({
    ok: false,
    error: { kind: "bucket-expired", bucket: bucket(BUCKET) },
  });
});
