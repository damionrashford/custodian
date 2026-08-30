import type { ContextItem } from "./context-item";

/**
 * The cheap variant of context management that does pay for itself: capping each tool output at a
 * fixed size before it enters history cut cost per turn by 38% in a paired comparison
 * (AI_Agent_Implementation_Plan_v2.txt:167). Truncation is recorded, because an agent that cannot
 * tell a short result from a truncated one will act on the wrong premise.
 */
export const DEFAULT_TOOL_OUTPUT_CAP = 4_000;

export function capToolOutput(
  tool: string,
  text: string,
  maxChars: number = DEFAULT_TOOL_OUTPUT_CAP,
): ContextItem {
  const truncated = text.length > maxChars;
  return {
    kind: "tool-output",
    tool,
    text: truncated ? text.slice(0, maxChars) : text,
    truncated,
  };
}
