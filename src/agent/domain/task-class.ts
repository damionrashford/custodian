import { brand, type Brand, err, ok, type Result } from "@custodian/primitives";

/** What a request is asking for, which is what the router selects a provider against. */
export type TaskClass = Brand<string, "TaskClass">;

export type InvalidTaskClass = { readonly kind: "invalid-task-class"; readonly received: string };

const TASK_CLASS_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;

export function parseTaskClass(value: string): Result<TaskClass, InvalidTaskClass> {
  return TASK_CLASS_PATTERN.test(value)
    ? ok(brand<TaskClass>(value))
    : err({ kind: "invalid-task-class", received: value });
}
