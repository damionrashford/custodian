import { expect, test } from "bun:test";
import {
  DEFAULT_BACKOFF,
  nextDeliveryAttempt,
  parseEventId,
  redrive,
  SIGNATURE_WINDOW_MS,
  verifySignature,
  type DeadLetter,
  type EventSigner,
  type SignedEvent,
} from "@custodian/event-delivery";

const signer: EventSigner = {
  sign: (timestampMs, body) => `sig(${String(timestampMs)}:${body})`,
};

function eventId(value: string) {
  const parsed = parseEventId(value);
  if (!parsed.ok) throw new Error(`fixture: bad event id ${value}`);
  return parsed.value;
}

const SENT_AT = 1_800_000_000_000;

function event(overrides: Partial<SignedEvent> = {}): SignedEvent {
  const base = {
    id: eventId("e_01jd7k9h2m4n6p8r0s2t4v6x8z"),
    payloadVersion: 1,
    body: '{"kind":"run.finished"}',
    timestampMs: SENT_AT,
  };
  return { ...base, signature: signer.sign(base.timestampMs, base.body), ...overrides };
}

test("a correctly signed, fresh event verifies", () => {
  const signed = event();
  expect(verifySignature(signed, SENT_AT + 1_000, signer)).toEqual({ ok: true, value: signed });
});

test("a tampered body fails verification", () => {
  const tampered = { ...event(), body: '{"kind":"run.finished","amount":999999}' };
  expect(verifySignature(tampered, SENT_AT + 1_000, signer)).toEqual({
    ok: false,
    error: { kind: "signature-mismatch" },
  });
});

test("a replayed event outside the window is rejected even with a valid signature", () => {
  const signed = event();
  const late = SENT_AT + SIGNATURE_WINDOW_MS + 1;
  expect(verifySignature(signed, late, signer)).toEqual({
    ok: false,
    error: { kind: "timestamp-outside-window", ageMs: SIGNATURE_WINDOW_MS + 1 },
  });
});

test("an event timestamped in the future is rejected, not treated as fresh", () => {
  const signed = event();
  expect(verifySignature(signed, SENT_AT - 1_000, signer).ok).toBe(false);
});

test("the signature covers the timestamp, so it is not replayable forever", () => {
  const signed = event();
  const restamped = { ...signed, timestampMs: SENT_AT + 60_000 };
  expect(verifySignature(restamped, SENT_AT + 61_000, signer)).toEqual({
    ok: false,
    error: { kind: "signature-mismatch" },
  });
});

test("backoff is exponential and jittered", () => {
  const plain = nextDeliveryAttempt(3, DEFAULT_BACKOFF, 0);
  const jittered = nextDeliveryAttempt(3, DEFAULT_BACKOFF, 0.9);
  if (plain.kind !== "retry" || jittered.kind !== "retry") throw new Error("expected retries");

  expect(plain.afterMs).toBe(4_000);
  expect(jittered.afterMs).toBeGreaterThan(plain.afterMs);
});

test("exhausting attempts dead-letters rather than retrying forever", () => {
  expect(nextDeliveryAttempt(DEFAULT_BACKOFF.maxAttempts, DEFAULT_BACKOFF, 0)).toEqual({
    kind: "dead-letter",
  });
});

test("a dead-lettered event can be found and redriven by its stable id", () => {
  const letters: readonly DeadLetter[] = [
    { event: event(), attempts: 6, lastError: "consumer 500" },
  ];
  const found = redrive(letters, eventId("e_01jd7k9h2m4n6p8r0s2t4v6x8z"));
  expect(found?.lastError).toBe("consumer 500");
});

test("redriving an unknown id returns nothing rather than a fabricated letter", () => {
  expect(redrive([], eventId("e_02jd7k9h2m4n6p8r0s2t4v6x8z"))).toBeUndefined();
});
