import { type Brand, err, ok, type Result } from "@custodian/domain-primitives";

/**
 * A version is a snapshot in history. A deployment is a label declaring what production runs.
 * Conflating the two is the most frequent mistake in this area
 * (AI_Agent_Implementation_Plan_v2.txt:233), so they are different types here and a version has no
 * mutable field at all.
 */
export type PromptVersion = Brand<string, "PromptVersion">;

export type InvalidPromptVersion = {
  readonly kind: "invalid-prompt-version";
  readonly received: string;
};

const PROMPT_VERSION_PATTERN = /^pv_[0-9a-z]{26}$/;

export function parsePromptVersion(value: string): Result<PromptVersion, InvalidPromptVersion> {
  return PROMPT_VERSION_PATTERN.test(value)
    ? ok(value as PromptVersion)
    : err({ kind: "invalid-prompt-version", received: value });
}

/**
 * A complete version captures text, model, parameters, change source, rationale and eval result.
 * Omitting any of these means rolling back blindly (AI_Agent_Implementation_Plan_v2.txt:233) — which
 * is why every field is required rather than optional. A half-recorded version is not a cheaper
 * version, it is an unusable one.
 */
export type PromptSnapshot = {
  readonly version: PromptVersion;
  readonly text: string;
  /** A pinned model snapshot, never a rolling alias — the registry doubles as the model inventory. */
  readonly model: string;
  readonly parameters: Readonly<Record<string, number>>;
  readonly changeSource: string;
  readonly rationale: string;
  readonly evalPassCaret: number;
  readonly createdAt: string;
};
