import { type Brand, err, ok, type Result } from "@custodian/domain-primitives";

/**
 * Every major provider delivers at least once and none delivers exactly once, which makes
 * idempotency the consumer's responsibility rather than something any vendor can ship. The
 * published contract therefore carries a stable event ID and documents the deduplication
 * expectation (AI_Agent_Implementation_Plan_v2.txt:202).
 */
export type EventId = Brand<string, "EventId">;

export type InvalidEventId = { readonly kind: "invalid-event-id"; readonly received: string };

const EVENT_ID_PATTERN = /^e_[0-9a-z]{26}$/;

export function parseEventId(value: string): Result<EventId, InvalidEventId> {
  return EVENT_ID_PATTERN.test(value)
    ? ok(value as EventId)
    : err({ kind: "invalid-event-id", received: value });
}

export type SignedEvent = {
  readonly id: EventId;
  readonly payloadVersion: number;
  readonly body: string;
  readonly timestampMs: number;
  readonly signature: string;
};

export type SignatureRejection =
  | { readonly kind: "signature-mismatch" }
  | { readonly kind: "timestamp-outside-window"; readonly ageMs: number };

/** Five minutes, the common default, to defeat replay. */
export const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

export interface EventSigner {
  sign(timestampMs: number, body: string): string;
}

/**
 * Signed over timestamp AND raw body — signing the body alone leaves the signature replayable
 * forever, which is the whole reason the window exists.
 */
export function verifySignature(
  event: SignedEvent,
  nowMs: number,
  signer: EventSigner,
): Result<SignedEvent, SignatureRejection> {
  if (signer.sign(event.timestampMs, event.body) !== event.signature) {
    return err({ kind: "signature-mismatch" });
  }
  const ageMs = nowMs - event.timestampMs;
  if (ageMs > SIGNATURE_WINDOW_MS || ageMs < 0) {
    return err({ kind: "timestamp-outside-window", ageMs });
  }
  return ok(event);
}
