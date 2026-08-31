import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";

/**
 * A version is a snapshot in history. A deployment is a label declaring what production runs.
 * Conflating the two is the most frequent mistake in this area
 * (implementation-plan.txt:233), so they are different types here and a version has no
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
    ? ok(brand<PromptVersion>(value))
    : err({ kind: "invalid-prompt-version", received: value });
}
