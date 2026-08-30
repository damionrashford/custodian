import { expect, test } from "bun:test";
import { agreementRate, calibrate, MIN_JUDGE_CORRELATION, type ScoredPair } from "@custodian/eval";

/** A judge tracking expert verdicts closely. */
const TRACKING: readonly ScoredPair[] = [
  { judge: 0.9, expert: 0.95 },
  { judge: 0.8, expert: 0.75 },
  { judge: 0.3, expert: 0.25 },
  { judge: 0.2, expert: 0.1 },
  { judge: 0.6, expert: 0.65 },
];

/**
 * The trap: a judge that stamps everything "pass" on a set where most outputs should pass. It looks
 * excellent by agreement and is worthless.
 */
const RUBBER_STAMP: readonly ScoredPair[] = [
  { judge: 1, expert: 1 },
  { judge: 1, expert: 1 },
  { judge: 1, expert: 1 },
  { judge: 1, expert: 1 },
  { judge: 1, expert: 1 },
  { judge: 1, expert: 1 },
  { judge: 1, expert: 1 },
  { judge: 1, expert: 1 },
  { judge: 1, expert: 1 },
  { judge: 1, expert: 0 },
];

test("a judge tracking expert verdicts is calibrated", () => {
  const verdict = calibrate(TRACKING);
  expect(verdict.kind).toBe("calibrated");
  if (verdict.kind !== "calibrated") return;
  expect(verdict.correlation).toBeGreaterThan(MIN_JUDGE_CORRELATION);
});

test("agreement rate flatters the rubber-stamp judge — 90% on an imbalanced set", () => {
  expect(agreementRate(RUBBER_STAMP, 0.5)).toBe(0.9);
});

test("calibration refuses that judge, because a judge with no variance measures nothing", () => {
  expect(calibrate(RUBBER_STAMP)).toEqual({ kind: "indeterminate", reason: "no-variance" });
});

test("indeterminate is not the same as a correlation of zero", () => {
  // Zero would read as "measured and poor". The truth is that it cannot be measured at all.
  const verdict = calibrate(RUBBER_STAMP);
  expect(verdict.kind).not.toBe("uncalibrated");
});

test("a judge scoring inversely to experts is uncalibrated, not merely weak", () => {
  const inverted: readonly ScoredPair[] = TRACKING.map((pair) => ({
    judge: 1 - pair.judge,
    expert: pair.expert,
  }));
  const verdict = calibrate(inverted);
  expect(verdict.kind).toBe("uncalibrated");
  if (verdict.kind !== "uncalibrated") return;
  expect(verdict.correlation).toBeLessThan(0);
});

test("too few pairs is indeterminate rather than a fabricated correlation", () => {
  expect(calibrate([{ judge: 1, expert: 1 }])).toEqual({
    kind: "indeterminate",
    reason: "too-few-pairs",
  });
});

test("the threshold is the spec's 0.7", () => {
  expect(MIN_JUDGE_CORRELATION).toBe(0.7);
});
