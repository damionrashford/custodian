import { type Brand, err, ok, type Result } from "@custodian/domain-primitives";

export type RunId = Brand<string, "RunId">;

export type InvalidRunId = { readonly kind: "invalid-run-id"; readonly received: string };

const RUN_ID_PATTERN = /^r_[0-9a-z]{26}$/;

export function parseRunId(value: string): Result<RunId, InvalidRunId> {
  return RUN_ID_PATTERN.test(value)
    ? ok(value as RunId)
    : err({ kind: "invalid-run-id", received: value });
}
