import { expect, test } from "bun:test";
import { assertWithinBudget, TOOL_CATALOGUE_BUDGET } from "@custodian/agent";

test("a catalogue at the budget is accepted", () => {
  expect(assertWithinBudget(TOOL_CATALOGUE_BUDGET)).toEqual({
    ok: true,
    value: TOOL_CATALOGUE_BUDGET,
  });
});

test("exceeding the budget fails and names what must be removed", () => {
  expect(assertWithinBudget(TOOL_CATALOGUE_BUDGET + 1)).toEqual({
    ok: false,
    error: {
      kind: "tool-budget-exceeded",
      count: TOOL_CATALOGUE_BUDGET + 1,
      budget: TOOL_CATALOGUE_BUDGET,
      mustRemove: 1,
    },
  });
});
