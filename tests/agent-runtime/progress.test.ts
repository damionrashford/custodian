import { expect, test } from "bun:test";
import { advance } from "@custodian/agent-runtime";

const fresh = { iteration: 0, stepsWithoutStateChange: 0, costMicros: 0, lastActionVerified: true };

test("new evidence resets stagnation and verifies the action", () => {
  const worn = { iteration: 3, stepsWithoutStateChange: 2, costMicros: 100, lastActionVerified: true };
  expect(advance(worn, { kind: "observed-new-evidence" }, 50)).toEqual({
    iteration: 4,
    stepsWithoutStateChange: 0,
    costMicros: 150,
    lastActionVerified: true,
  });
});

test("repeated evidence counts toward stagnation but stays verified", () => {
  const next = advance(fresh, { kind: "observed-nothing-new" }, 10);
  expect(next.stepsWithoutStateChange).toBe(1);
  expect(next.lastActionVerified).toBe(true);
  expect(next.iteration).toBe(1);
});

test("a failed tool leaves the action unverified — the widest-blast-radius halt", () => {
  const next = advance(fresh, { kind: "tool-failed" }, 10);
  expect(next.lastActionVerified).toBe(false);
  expect(next.stepsWithoutStateChange).toBe(1);
});

test("an unparseable step is stagnation, not an unverified action", () => {
  const next = advance(fresh, { kind: "step-unparseable" }, 10);
  expect(next.lastActionVerified).toBe(true);
  expect(next.stepsWithoutStateChange).toBe(1);
});
