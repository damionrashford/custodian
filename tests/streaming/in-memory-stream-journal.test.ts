import { expect, test } from "bun:test";
import { AesGcmSubjectKeyStore } from "@custodian/crypto-shred";
import {
  parseRetentionBucket,
  parseRunId,
  parseSubjectId,
  type SealedContent,
} from "@custodian/domain-primitives";

import { InMemoryStreamJournal, STREAMING_RESPONSE_HEADERS } from "@custodian/streaming";

const AT = "2026-08-29T00:00:00.000Z";
const keys = new AesGcmSubjectKeyStore({ now: () => new Date(AT) });

function run() {
  const parsed = parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z");
  if (!parsed.ok) throw new Error("fixture: bad run id");
  return parsed.value;
}

async function seal(plaintext: string): Promise<SealedContent> {
  const subject = parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z");
  const bucket = parseRetentionBucket("content-2026-08");
  if (!subject.ok || !bucket.ok) throw new Error("fixture");
  const sealed = await keys.seal({ subject: subject.value, bucket: bucket.value, plaintext });
  if (!sealed.ok) throw new Error("seal failed");
  return sealed.value;
}

async function journalOfThree() {
  const journal = new InMemoryStreamJournal();
  for (const chunk of ["alpha", "beta", "gamma"]) {
    await journal.append(run(), await seal(chunk));
  }
  return journal;
}

async function plaintextOf(chunks: readonly SealedContent[]): Promise<readonly string[]> {
  const out: string[] = [];
  for (const chunk of chunks) {
    const unsealed = await keys.unseal(chunk);
    if (!unsealed.ok) throw new Error("unseal failed");
    out.push(unsealed.value);
  }
  return out;
}

test("appending returns a monotonically increasing offset", async () => {
  const journal = new InMemoryStreamJournal();
  expect(await journal.append(run(), await seal("alpha"))).toEqual({ ok: true, value: 0 });
  expect(await journal.append(run(), await seal("beta"))).toEqual({ ok: true, value: 1 });
});

test("a client that dropped after chunk one resumes from chunk two, not from scratch", async () => {
  const journal = await journalOfThree();
  const resumed = await journal.since(run(), 1);
  if (!resumed.ok) throw new Error("resume failed");
  expect(await plaintextOf(resumed.value)).toEqual(["beta", "gamma"]);
});

test("resuming from the head returns nothing rather than replaying the stream", async () => {
  const journal = await journalOfThree();
  expect(await journal.since(run(), 3)).toEqual({ ok: true, value: [] });
});

test("resuming an unknown run is an error, not a silent empty stream", async () => {
  const journal = new InMemoryStreamJournal();
  expect(await journal.since(run(), 0)).toEqual({
    ok: false,
    error: { kind: "unknown-run", runId: run() },
  });
});

test("the journal holds ciphertext — a streamed completion is a completion", async () => {
  const journal = new InMemoryStreamJournal();
  await journal.append(run(), await seal("Jane Doe, jane@example.test"));
  const stored = await journal.since(run(), 0);
  if (!stored.ok) throw new Error("read failed");

  expect(JSON.stringify(stored.value)).not.toContain("jane@example.test");
});

test("destroying the subject key makes buffered stream content unrecoverable", async () => {
  const journal = new InMemoryStreamJournal();
  await journal.append(run(), await seal("Jane Doe, jane@example.test"));

  const subject = parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z");
  if (!subject.ok) throw new Error("fixture");
  await keys.destroySubjectKey(subject.value);

  const stored = await journal.since(run(), 0);
  if (!stored.ok) throw new Error("read failed");
  const first = stored.value[0];
  if (first === undefined) throw new Error("nothing buffered");

  expect(await keys.unseal(first)).toEqual({
    ok: false,
    error: { kind: "subject-erased", subject: subject.value },
  });
});

test("streaming responses defeat CDN buffering", () => {
  expect(STREAMING_RESPONSE_HEADERS).toEqual({
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
  });
});
