import type { EventId, SignedEvent } from "./signed-event";

export type DeliveryAttempt =
  | { readonly kind: "retry"; readonly afterMs: number; readonly attempt: number }
  | { readonly kind: "dead-letter" };

export type BackoffPolicy = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
};

export const DEFAULT_BACKOFF: BackoffPolicy = { maxAttempts: 6, baseDelayMs: 1_000 };

/**
 * Jitter is not optional. If ten thousand deliveries fail during a brief consumer outage,
 * unjittered retries all fire at the same interval and create a thundering herd
 * (AI_Agent_Implementation_Plan_v2.txt:203). `jitter` is supplied in [0, 1) so this stays pure.
 */
export function nextDeliveryAttempt(
  attempt: number,
  policy: BackoffPolicy,
  jitter: number,
): DeliveryAttempt {
  if (attempt >= policy.maxAttempts) {
    return { kind: "dead-letter" };
  }
  const exponential = policy.baseDelayMs * 2 ** (attempt - 1);
  return { kind: "retry", afterMs: Math.round(exponential * (1 + jitter)), attempt: attempt + 1 };
}

export type DeadLetter = {
  readonly event: SignedEvent;
  readonly attempts: number;
  readonly lastError: string;
};

/**
 * The dead-letter queue is a replay buffer, not a graveyard. An operator inspects a dead-lettered
 * event, fixes the handler defect and redrives it; because events are keyed on a stable idempotent
 * ID, replaying one already processed is safe. Manual replay is the single most requested webhook
 * feature by consuming developers, so it is scoped into v1
 * (AI_Agent_Implementation_Plan_v2.txt:204).
 */
export function redrive(letters: readonly DeadLetter[], id: EventId): DeadLetter | undefined {
  return letters.find((letter) => letter.event.id === id);
}
