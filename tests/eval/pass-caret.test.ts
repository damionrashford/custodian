import { expect, test } from "bun:test";
import {
  gateOnConsistency,
  measureConsistency,
  type ConsistencyReport,
  type TaskRuns,
} from "@custodian/eval";

function report(tasks: readonly TaskRuns[]): ConsistencyReport {
  const measured = measureConsistency(tasks);
  if (!measured.ok) throw new Error(`fixture: ${measured.error.kind}`);
  return measured.value;
}

/** The tau-bench shape: most tasks pass sometimes, few pass every time. */
const FLAKY: readonly TaskRuns[] = [
  { task: "refund", outcomes: [true, true, true] },
  { task: "escalate", outcomes: [true, false, true] },
  { task: "lookup", outcomes: [true, true, false] },
  { task: "cancel", outcomes: [false, true, true] },
];

test("pass^k counts only tasks that succeeded on every trial", () => {
  expect(report(FLAKY).passCaret).toBe(0.25);
});

test("pass@k flatters the same data", () => {
  expect(report(FLAKY).passAt).toBe(1);
});

test("the gap between them is the whole point — a flattering metric hides a flaky agent", () => {
  const measured = report(FLAKY);
  expect(measured.passAt).toBeGreaterThan(measured.passCaret);
});

test("the gate reads pass^k, so a flaky agent fails a threshold pass@k would clear", () => {
  const measured = report(FLAKY);
  expect(gateOnConsistency(measured, 0.9)).toEqual({
    kind: "fail",
    passCaret: 0.25,
    threshold: 0.9,
  });
  // The same agent would have sailed through on the generous metric.
  expect(measured.passAt).toBeGreaterThanOrEqual(0.9);
});

test("a consistently passing agent clears the gate", () => {
  const solid: readonly TaskRuns[] = [
    { task: "refund", outcomes: [true, true, true] },
    { task: "escalate", outcomes: [true, true, true] },
  ];
  expect(gateOnConsistency(report(solid), 0.9)).toEqual({ kind: "pass" });
});

test("a single trial per task is refused, not silently reported as pass^1", () => {
  const measured = measureConsistency([{ task: "refund", outcomes: [true] }]);
  expect(measured).toEqual({
    ok: false,
    error: { kind: "single-trial", task: "refund" },
  });
});

test("uneven trial counts are refused — the k in pass^k must mean one thing", () => {
  const measured = measureConsistency([
    { task: "refund", outcomes: [true, true] },
    { task: "escalate", outcomes: [true, true, true] },
  ]);
  expect(measured).toEqual({
    ok: false,
    error: { kind: "uneven-trials", task: "escalate", expected: 2, found: 3 },
  });
});

test("an empty suite is refused rather than reported as perfect", () => {
  expect(measureConsistency([])).toEqual({ ok: false, error: { kind: "no-tasks" } });
});
