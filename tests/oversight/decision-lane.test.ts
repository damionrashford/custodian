import { expect, test } from "bun:test";
import {
  assessOversight,
  laneFor,
  LANE_POLICIES,
  resolve,
  type ReviewOutcome,
} from "@custodian/oversight";

const AT = "2026-08-29T00:00:00.000Z";

test("risk determines the lane, and only the fast lane may auto-approve", () => {
  expect(laneFor("low-risk-reversible")).toBe("fast");
  expect(laneFor("sensitive-data-access")).toBe("standard");
  expect(laneFor("financial-or-irreversible")).toBe("high");
  expect(LANE_POLICIES.fast.onTimeout).toBe("auto-approve");
  expect(LANE_POLICIES.standard.onTimeout).toBe("deny");
  expect(LANE_POLICIES.high.onTimeout).toBe("deny");
});

test("a timed-out financial action is DENIED — failing open is the failure this prevents", () => {
  expect(
    resolve(
      { action: "financial-or-irreversible", requestedAt: AT },
      { kind: "timed-out", lane: "high", waitedMs: 30 * 60_000 },
    ),
  ).toEqual({ kind: "denied", reason: "timed-out-fail-safe" });
});

test("a timed-out sensitive-data access is denied too", () => {
  expect(
    resolve(
      { action: "sensitive-data-access", requestedAt: AT },
      { kind: "timed-out", lane: "standard", waitedMs: 5 * 60_000 },
    ),
  ).toEqual({ kind: "denied", reason: "timed-out-fail-safe" });
});

test("a timed-out low-risk reversible action auto-approves within its limits", () => {
  expect(
    resolve(
      { action: "low-risk-reversible", requestedAt: AT },
      { kind: "timed-out", lane: "fast", waitedMs: 10_000 },
    ),
  ).toEqual({ kind: "proceed" });
});

test("an explicit rejection denies regardless of lane", () => {
  expect(
    resolve(
      { action: "low-risk-reversible", requestedAt: AT },
      { kind: "rejected", reviewer: "p_ops", tookMs: 4_000 },
    ),
  ).toEqual({ kind: "denied", reason: "rejected" });
});

function outcomes(count: number, approved: number, tookMs: number): readonly ReviewOutcome[] {
  return Array.from({ length: count }, (_unused, index) =>
    index < approved
      ? ({ kind: "approved", reviewer: "p_ops", tookMs } as const)
      : ({ kind: "rejected", reviewer: "p_ops", tookMs } as const),
  );
}

test("approving nearly everything in seconds is clicking, not reviewing", () => {
  const health = assessOversight(outcomes(100, 100, 3_000));
  expect(health.kind).toBe("rubber-stamping");
});

test("a high approval rate alone is not rubber-stamping — the queue may be genuinely low risk", () => {
  // Same approval rate, but the reviewer is spending real time on each.
  const health = assessOversight(outcomes(100, 100, 45_000));
  expect(health.kind).toBe("healthy");
});

test("fast decisions alone are not rubber-stamping either — both conditions must hold", () => {
  const health = assessOversight(outcomes(100, 70, 3_000));
  expect(health.kind).toBe("healthy");
});

test("a small sample is reported as insufficient rather than as a verdict", () => {
  expect(assessOversight(outcomes(5, 5, 1_000))).toEqual({
    kind: "insufficient-sample",
    reviewed: 5,
  });
});

test("timeouts are not counted as reviews — an unanswered queue is not a fast reviewer", () => {
  const withTimeouts: readonly ReviewOutcome[] = [
    ...outcomes(19, 19, 1_000),
    { kind: "timed-out", lane: "standard", waitedMs: 300_000 },
  ];
  expect(assessOversight(withTimeouts)).toEqual({ kind: "insufficient-sample", reviewed: 19 });
});
