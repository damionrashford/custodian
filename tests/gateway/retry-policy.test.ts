import { expect, test } from "bun:test";
import { DEFAULT_RETRY_POLICY, nextRetry, type ProviderFailure } from "@custodian/gateway";

const TIMEOUT: ProviderFailure = { kind: "timeout" };
const RATE_LIMITED: ProviderFailure = { kind: "rate-limited", retryAfterMs: 4_000 };
const REFUSED: ProviderFailure = { kind: "refused", reason: "content policy" };

const ctx = (attempt: number, jitter: number) => ({
  attempt,
  policy: DEFAULT_RETRY_POLICY,
  jitter,
});

test("a transient failure retries with exponential backoff", () => {
  const first = nextRetry(TIMEOUT, ctx(1, 0));
  const second = nextRetry(TIMEOUT, ctx(2, 0));

  expect(first.kind).toBe("retry");
  expect(second.kind).toBe("retry");
  if (first.kind !== "retry" || second.kind !== "retry") return;
  expect(second.afterMs).toBeGreaterThan(first.afterMs);
});

test("jitter is applied, so ten thousand failed deliveries do not fire together", () => {
  const noJitter = nextRetry(TIMEOUT, ctx(2, 0));
  const fullJitter = nextRetry(TIMEOUT, ctx(2, 0.999));

  if (noJitter.kind !== "retry" || fullJitter.kind !== "retry") throw new Error("expected retries");
  expect(fullJitter.afterMs).toBeGreaterThan(noJitter.afterMs);
});

test("a rate-limited failure honours the provider's own retry-after", () => {
  expect(nextRetry(RATE_LIMITED, ctx(1, 0))).toEqual({
    kind: "retry",
    afterMs: 4_000,
    attempt: 2,
  });
});

test("a refusal is never retried — it is not transient", () => {
  expect(nextRetry(REFUSED, ctx(1, 0))).toEqual({
    kind: "give-up",
    reason: "not-transient",
  });
});

test("retries stop at the policy ceiling", () => {
  expect(nextRetry(TIMEOUT, ctx(DEFAULT_RETRY_POLICY.maxAttempts, 0))).toEqual({
    kind: "give-up",
    reason: "attempts-exhausted",
  });
});
