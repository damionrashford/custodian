import { expect, test } from "bun:test";
import { capToolOutput, DEFAULT_TOOL_OUTPUT_CAP } from "@custodian/knowledge";

test("an output within the cap is untouched and not marked truncated", () => {
  const capped = capToolOutput("search", "short result", 100);
  expect(capped).toEqual({
    kind: "tool-output",
    tool: "search",
    text: "short result",
    truncated: false,
  });
});

test("an oversized output is cut to the cap before entering history", () => {
  const capped = capToolOutput("search", "x".repeat(10_000), 100);
  expect(capped.kind).toBe("tool-output");
  expect(capped.text).toHaveLength(100);
});

test("truncation is recorded, so the agent cannot mistake a cut result for a short one", () => {
  const capped = capToolOutput("search", "x".repeat(10_000), 100);
  if (capped.kind !== "tool-output") throw new Error("expected a tool output");
  expect(capped.truncated).toBe(true);
});

test("a default cap exists rather than each call site inventing one", () => {
  expect(DEFAULT_TOOL_OUTPUT_CAP).toBeGreaterThan(0);
});
