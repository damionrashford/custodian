import { expect, test } from "bun:test";
import { DEFAULT_LOOP_LIMITS, evaluateLoop, type RunState } from "@custodian/agent-loop";

const healthy: RunState = {
  iteration: 1,
  stepsWithoutStateChange: 0,
  costMicros: 1_000,
  lastActionVerified: true,
};

test("a healthy run continues", () => {
  expect(evaluateLoop(healthy, DEFAULT_LOOP_LIMITS)).toEqual({ kind: "continue" });
});

test("the iteration ceiling halts the run", () => {
  expect(
    evaluateLoop({ ...healthy, iteration: DEFAULT_LOOP_LIMITS.maxIterations }, DEFAULT_LOOP_LIMITS),
  ).toEqual({ kind: "halt", reason: "iteration-ceiling" });
});

test("consecutive steps with no state change halt as stagnation, not as success", () => {
  expect(
    evaluateLoop(
      { ...healthy, stepsWithoutStateChange: DEFAULT_LOOP_LIMITS.maxStepsWithoutProgress },
      DEFAULT_LOOP_LIMITS,
    ),
  ).toEqual({ kind: "halt", reason: "stagnating" });
});

test("the per-run cost ceiling halts the run", () => {
  expect(
    evaluateLoop(
      { ...healthy, costMicros: DEFAULT_LOOP_LIMITS.costCeilingMicros },
      DEFAULT_LOOP_LIMITS,
    ),
  ).toEqual({ kind: "halt", reason: "cost-ceiling" });
});

test("an unverified action halts before the next step is planned", () => {
  expect(evaluateLoop({ ...healthy, lastActionVerified: false }, DEFAULT_LOOP_LIMITS)).toEqual({
    kind: "halt",
    reason: "unverified-action",
  });
});

test("an unverified action outranks a cheaper counter, because it produces wrong side effects", () => {
  const both: RunState = {
    ...healthy,
    lastActionVerified: false,
    iteration: DEFAULT_LOOP_LIMITS.maxIterations,
  };
  expect(evaluateLoop(both, DEFAULT_LOOP_LIMITS)).toEqual({
    kind: "halt",
    reason: "unverified-action",
  });
});

test("stagnation is detected before the iteration ceiling, so a stuck run halts early", () => {
  const stuck: RunState = {
    ...healthy,
    stepsWithoutStateChange: DEFAULT_LOOP_LIMITS.maxStepsWithoutProgress,
    iteration: 4,
  };
  expect(evaluateLoop(stuck, DEFAULT_LOOP_LIMITS).kind).toBe("halt");
  expect(evaluateLoop(stuck, DEFAULT_LOOP_LIMITS)).toEqual({
    kind: "halt",
    reason: "stagnating",
  });
});
