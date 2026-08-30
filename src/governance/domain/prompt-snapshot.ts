import type { ModelSnapshot, PromptVersion } from "@custodian/primitives";

/**
 * A complete version captures text, model, parameters, change source, rationale and eval result.
 * Omitting any of these means rolling back blindly (AI_Agent_Implementation_Plan_v2.txt:233) — which
 * is why every field is required rather than optional. A half-recorded version is not a cheaper
 * version, it is an unusable one.
 */
export type PromptSnapshot = {
  readonly version: PromptVersion;
  readonly text: string;
  /** A pinned snapshot, never a rolling alias — the registry doubles as the model inventory. */
  readonly model: ModelSnapshot;
  readonly parameters: Readonly<Record<string, number>>;
  readonly changeSource: string;
  readonly rationale: string;
  readonly evalPassCaret: number;
  readonly createdAt: string;
};
