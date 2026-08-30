import type { ProviderFailure } from "./model-provider";

export type RetryPolicy = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 250,
  maxDelayMs: 30_000,
};

export type RetryDecision =
  | { readonly kind: "retry"; readonly afterMs: number; readonly attempt: number }
  | { readonly kind: "give-up"; readonly reason: "not-transient" | "attempts-exhausted" };

function isTransient(failure: ProviderFailure): boolean {
  switch (failure.kind) {
    case "rate-limited":
    case "timeout":
    case "unavailable":
      return true;
    case "refused":
      return false;
    default: {
      const unhandled: never = failure;
      return unhandled;
    }
  }
}

/**
 * Pure. Jitter is not optional — if ten thousand deliveries fail during a
 * brief outage, unjittered retries all fire at the same interval and create a thundering herd
 * (AI_Agent_Implementation_Plan_v2.txt:203).
 */
export type RetryContext = {
  readonly attempt: number;
  readonly policy: RetryPolicy;
  /** Supplied in [0, 1) by the caller rather than drawn here, so backoff is testable. */
  readonly jitter: number;
};

export function nextRetry(failure: ProviderFailure, context: RetryContext): RetryDecision {
  if (!isTransient(failure)) {
    return { kind: "give-up", reason: "not-transient" };
  }
  if (context.attempt >= context.policy.maxAttempts) {
    return { kind: "give-up", reason: "attempts-exhausted" };
  }
  if (failure.kind === "rate-limited") {
    return { kind: "retry", afterMs: failure.retryAfterMs, attempt: context.attempt + 1 };
  }

  const exponential = Math.min(
    context.policy.baseDelayMs * 2 ** (context.attempt - 1),
    context.policy.maxDelayMs,
  );
  return {
    kind: "retry",
    afterMs: Math.round(exponential * (1 + context.jitter)),
    attempt: context.attempt + 1,
  };
}
