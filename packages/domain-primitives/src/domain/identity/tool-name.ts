import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";

/** Names a registered tool. The execution log records one per call, so the type is shared. */
export type ToolName = Brand<string, "ToolName">;

export type InvalidToolName = { readonly kind: "invalid-tool-name"; readonly received: string };

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

export function parseToolName(value: string): Result<ToolName, InvalidToolName> {
  return TOOL_NAME_PATTERN.test(value)
    ? ok(brand<ToolName>(value))
    : err({ kind: "invalid-tool-name", received: value });
}
