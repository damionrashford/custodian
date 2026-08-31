/**
 * The OTel GenAI semantic conventions, adopted with the version pinned as data
 * (implementation-plan.txt:262): the conventions are pre-stable ("development"
 * stability, now maintained in the dedicated semantic-conventions-genai repository) and attribute
 * names still churn — gen_ai.system has already been superseded by gen_ai.provider.name. What
 * Custodian emits is pinned here; tests/observability/gen-ai-conventions.test.ts transcribes the
 * adopted names the way the retention test transcribes the spec's schedule (LD-9), so drift is a
 * build failure, not a surprise in a dashboard.
 *
 * Content-bearing attributes (gen_ai.input.messages, gen_ai.output.messages,
 * gen_ai.system_instructions) are deliberately absent: telemetry is metadata-only. Content stays
 * sealed in the execution log (LD-8), and the attribute key union below is what makes a content
 * attribute unrepresentable rather than merely discouraged.
 */
export const GEN_AI_CONVENTIONS_PIN = "otel-gen_ai/development@2026-08-29";

export const GEN_AI_ATTRIBUTE = {
  operationName: "gen_ai.operation.name",
  providerName: "gen_ai.provider.name",
  requestModel: "gen_ai.request.model",
  responseModel: "gen_ai.response.model",
  usageInputTokens: "gen_ai.usage.input_tokens",
  usageOutputTokens: "gen_ai.usage.output_tokens",
} as const;

export type GenAiAttributeName = (typeof GEN_AI_ATTRIBUTE)[keyof typeof GEN_AI_ATTRIBUTE];

/** One inference span. `name` follows the conventions' `{operation} {model}` rule. */
export type GenAiSpan = {
  readonly name: string;
  readonly at: string;
  readonly attributes: Readonly<Partial<Record<GenAiAttributeName, string | number>>>;
};
