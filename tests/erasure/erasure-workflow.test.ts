import { expect, test } from "bun:test";
import { parseRetentionBucket, parseSubjectId } from "@custodian/domain-primitives";
import { AesGcmSubjectKeyStore } from "@custodian/crypto-shred";
import { DATA_MAP, runErasure, type ErasureRequest } from "@custodian/erasure";

function subject(value: string) {
  const parsed = parseSubjectId(value);
  if (!parsed.ok) throw new Error(`fixture: bad subject ${value}`);
  return parsed.value;
}

const SUBJECT = subject("s_01jd7k9h2m4n6p8r0s2t4v6x8z");

function store() {
  return new AesGcmSubjectKeyStore({ now: () => new Date("2026-08-29T00:00:00.000Z") });
}

function request(overrides: Partial<ErasureRequest> = {}): ErasureRequest {
  return {
    identity: { kind: "resolved", subject: SUBJECT },
    receivedAt: "2026-08-29T00:00:00.000Z",
    legalHold: undefined,
    coveredLocations: DATA_MAP,
    ...overrides,
  };
}

test("the happy path erases and returns a proof", async () => {
  const outcome = await runErasure(request(), store());
  expect(outcome.ok).toBe(true);
  if (!outcome.ok || outcome.value.kind !== "erased") throw new Error("expected erasure");
  expect(outcome.value.subject).toBe(SUBJECT);
  expect(outcome.value.proof.target).toBe(SUBJECT);
});

test("the statutory clock starts at receipt, not at completion", async () => {
  const outcome = await runErasure(request(), store());
  if (!outcome.ok || outcome.value.kind !== "erased") throw new Error("expected erasure");
  expect(outcome.value.dueBy).toBe("2026-09-28T00:00:00.000Z");
});

test("ambiguous identity escalates to human review rather than silently proceeding", async () => {
  const keys = store();
  const outcome = await runErasure(
    request({ identity: { kind: "ambiguous", candidates: 2 } }),
    keys,
  );
  expect(outcome).toEqual({
    ok: true,
    value: { kind: "awaiting-human-review", reason: "identity-ambiguous" },
  });

  // Nothing was destroyed: the subject's data must still be readable.
  const bucket = parseRetentionBucket("content-2026-08");
  if (!bucket.ok) throw new Error("fixture: bad bucket");
  const sealed = await keys.seal({
    subject: SUBJECT,
    bucket: bucket.value,
    plaintext: "still here",
  });
  if (!sealed.ok) throw new Error("seal failed");
  expect(await keys.unseal(sealed.value)).toEqual({ ok: true, value: "still here" });
});

test("a legal hold blocks erasure and carries its basis", async () => {
  const hold = { basis: "litigation hold 2026-114", recordedAt: "2026-08-20T00:00:00.000Z" };
  expect(await runErasure(request({ legalHold: hold }), store())).toEqual({
    ok: true,
    value: { kind: "blocked", hold },
  });
});

test("a location missing from the data map is reported as a defect, not skipped", async () => {
  const outcome = await runErasure(
    request({ coveredLocations: DATA_MAP.filter((l) => l !== "response-cache") }),
    store(),
  );
  expect(outcome).toEqual({
    ok: true,
    value: { kind: "data-map-defect", missing: ["response-cache"] },
  });
});

test("the data map is checked BEFORE the key is destroyed", async () => {
  const keys = store();
  await runErasure(request({ coveredLocations: [] }), keys);

  // The key must survive, or the erasure would be unprovable rather than merely incomplete.
  const bucket = parseRetentionBucket("content-2026-08");
  if (!bucket.ok) throw new Error("fixture: bad bucket");
  const sealed = await keys.seal({ subject: SUBJECT, bucket: bucket.value, plaintext: "intact" });
  if (!sealed.ok) throw new Error("seal failed");
  expect(await keys.unseal(sealed.value)).toEqual({ ok: true, value: "intact" });
});

test("a repeat request is a no-op returning the original proof", async () => {
  const keys = store();
  const first = await runErasure(request(), keys);
  const second = await runErasure(request(), keys);
  expect(second).toEqual(first);
});

test("every location in the data map is invalidated, cache included", async () => {
  const outcome = await runErasure(request(), store());
  if (!outcome.ok || outcome.value.kind !== "erased") throw new Error("expected erasure");
  expect(outcome.value.invalidated).toEqual(DATA_MAP);
  expect(outcome.value.invalidated).toContain("response-cache");
  expect(outcome.value.invalidated).toContain("routing-memory");
});

test("an unresolved identity is rejected, and is not the same failure as a key-store fault", async () => {
  const outcome = await runErasure(request({ identity: { kind: "unresolved" } }), store());
  expect(outcome).toEqual({ ok: false, error: { kind: "no-subject-resolved" } });
});

test("a key-store fault is reported as retryable infrastructure, not as an identity problem", async () => {
  const failing = {
    destroySubjectKey: () =>
      Promise.resolve({ ok: false as const, error: { kind: "ciphertext-corrupt" as const } }),
  };
  const outcome = await runErasure(request(), failing);

  // The durable workflow retries this. Reporting it as no-subject-resolved would route a transient
  // fault to a human identity-review queue instead.
  expect(outcome).toEqual({
    ok: false,
    error: { kind: "key-destruction-failed", cause: { kind: "ciphertext-corrupt" } },
  });
});
