import {
  err,
  isRecord,
  ok,
  parseToolName,
  type Result,
  type ToolName,
} from "@custodian/primitives";

export type AgentStep =
  | { readonly kind: "use-tool"; readonly tool: ToolName; readonly argumentsJson: string }
  | { readonly kind: "answer"; readonly text: string };

export type StepParseFailure = { readonly kind: "unparseable-step"; readonly reason: string };

/**
 * The model's reply is untrusted input and crosses this boundary exactly once (parse, don't
 * validate). Models wrap JSON in prose and fences, so the parser extracts the outermost object
 * rather than demanding a bare one — but the object itself is held to the protocol exactly:
 * an unknown action is a refusal, never a guess.
 */
export function parseStep(completionText: string): Result<AgentStep, StepParseFailure> {
  const start = completionText.indexOf("{");
  const end = completionText.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return err({ kind: "unparseable-step", reason: "no-json-object" });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(completionText.slice(start, end + 1));
  } catch {
    return err({ kind: "unparseable-step", reason: "invalid-json" });
  }
  if (!isRecord(parsed)) {
    return err({ kind: "unparseable-step", reason: "not-an-object" });
  }
  const action = parsed["action"];
  if (action === "answer") {
    const text = parsed["text"];
    return typeof text === "string" && text.length > 0
      ? ok({ kind: "answer", text })
      : err({ kind: "unparseable-step", reason: "answer-without-text" });
  }
  if (action === "use-tool") {
    const rawTool = parsed["tool"];
    if (typeof rawTool !== "string") {
      return err({ kind: "unparseable-step", reason: "tool-not-a-string" });
    }
    const tool = parseToolName(rawTool);
    if (!tool.ok) {
      return err({ kind: "unparseable-step", reason: "invalid-tool-name" });
    }
    return ok({
      kind: "use-tool",
      tool: tool.value,
      argumentsJson: JSON.stringify(parsed["arguments"] ?? {}),
    });
  }
  return err({ kind: "unparseable-step", reason: "unknown-action" });
}
