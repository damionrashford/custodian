import type { LoggedEntry } from "@custodian/execution-log";
import { GEN_AI_ATTRIBUTE, type GenAiSpan } from "../domain/gen-ai-conventions";

/**
 * One inference span per model-invoked entry, per the conventions' span shape
 * (Agent_Architecture_Addendum.txt:123). The run's usage-recorded entry attaches to the last
 * invocation before it: the gateway records usage once, at close, for the attempt that served —
 * earlier attempts failed and were never billed.
 *
 * Metadata only, by construction: `GenAiSpan.attributes` is keyed by the pinned attribute union,
 * and no content-bearing name is in the pin. Sealed content cannot reach a span without widening
 * the pin first, which fails the transcription test before it reaches review.
 */
export function spansFromRun(log: readonly LoggedEntry[]): readonly GenAiSpan[] {
  const spans: GenAiSpan[] = [];
  let lastInvocation = -1;
  for (const entry of log) {
    if (entry.event.kind === "model-invoked") {
      spans.push({
        name: `chat ${entry.event.snapshot}`,
        at: entry.at,
        attributes: {
          [GEN_AI_ATTRIBUTE.operationName]: "chat",
          [GEN_AI_ATTRIBUTE.providerName]: entry.event.routerDecision,
          [GEN_AI_ATTRIBUTE.requestModel]: entry.event.snapshot,
          [GEN_AI_ATTRIBUTE.responseModel]: entry.event.snapshot,
        },
      });
      lastInvocation = spans.length - 1;
    }
    if (entry.event.kind === "usage-recorded") {
      const span = spans[lastInvocation];
      if (span !== undefined) {
        spans[lastInvocation] = {
          ...span,
          attributes: {
            ...span.attributes,
            [GEN_AI_ATTRIBUTE.usageInputTokens]: entry.event.inputTokens,
            [GEN_AI_ATTRIBUTE.usageOutputTokens]: entry.event.outputTokens,
          },
        };
      }
    }
  }
  return spans;
}
