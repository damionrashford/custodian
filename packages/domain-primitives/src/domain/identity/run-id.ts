import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";

export type RunId = Brand<string, "RunId">;

export type InvalidRunId = { readonly kind: "invalid-run-id"; readonly received: string };

const RUN_ID_PATTERN = /^r_[0-9a-z]{26}$/;

export function parseRunId(value: string): Result<RunId, InvalidRunId> {
  return RUN_ID_PATTERN.test(value)
    ? ok(brand<RunId>(value))
    : err({ kind: "invalid-run-id", received: value });
}
