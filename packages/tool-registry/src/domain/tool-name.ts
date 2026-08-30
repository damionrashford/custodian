import { brand, type Brand, err, ok, type Result } from "@custodian/domain-primitives";

export type ToolName = Brand<string, "ToolName">;
export type TaskClass = Brand<string, "TaskClass">;

export type InvalidToolName = { readonly kind: "invalid-tool-name"; readonly received: string };
export type InvalidTaskClass = { readonly kind: "invalid-task-class"; readonly received: string };

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;
const TASK_CLASS_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;

export function parseToolName(value: string): Result<ToolName, InvalidToolName> {
  return TOOL_NAME_PATTERN.test(value)
    ? ok(brand<ToolName>(value))
    : err({ kind: "invalid-tool-name", received: value });
}

export function parseTaskClass(value: string): Result<TaskClass, InvalidTaskClass> {
  return TASK_CLASS_PATTERN.test(value)
    ? ok(brand<TaskClass>(value))
    : err({ kind: "invalid-task-class", received: value });
}
