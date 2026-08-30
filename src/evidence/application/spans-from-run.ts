import type { LoggedEntry } from "../domain/logged-entry";
import { GEN_AI_ATTRIBUTE, type GenAiSpan } from "../domain/gen-ai-conventions";

/**
 * One inference span per model-invoked entry, per the conventions' span shape
 * (Agent_Architecture_Addendum.txt:123). Usage attaches by the invocationSeq the usage-recorded
 * event carries — recorded, never inferred from adjacency — and multiple settlements of one
 * invocation sum, the same arithmetic meterEventsFrom applies, so span telemetry and meter events
 * cannot disagree about the same log.
 *
 * Metadata only, by construction: `GenAiSpan.attributes` is keyed by the pinned attribute union,
 * and no content-bearing name is in the pin. Sealed content cannot reach a span without widening
 * the pin first, which fails the transcription test before it reaches review.
 */
export function spansFromRun(log: readonly LoggedEntry[]): readonly GenAiSpan[] {
  const settledByInvocation = new Map<number, { input: number; output: number }>();
  for (const entry of log) {
    if (entry.event.kind === "usage-recorded") {
      const settled = settledByInvocation.get(entry.event.invocationSeq) ?? {
        input: 0,
        output: 0,
      };
      settledByInvocation.set(entry.event.invocationSeq, {
        input: settled.input + entry.event.inputTokens,
        output: settled.output + entry.event.outputTokens,
      });
    }
  }

  const spans: GenAiSpan[] = [];
  for (const entry of log) {
    if (entry.event.kind !== "model-invoked") {
      continue;
    }
    const base = {
      [GEN_AI_ATTRIBUTE.operationName]: "chat",
      [GEN_AI_ATTRIBUTE.providerName]: entry.event.routerDecision,
      [GEN_AI_ATTRIBUTE.requestModel]: entry.event.snapshot,
      [GEN_AI_ATTRIBUTE.responseModel]: entry.event.snapshot,
    };
    const settled = settledByInvocation.get(entry.seq);
    spans.push({
      name: `chat ${entry.event.snapshot}`,
      at: entry.at,
      attributes:
        settled === undefined
          ? base
          : {
              ...base,
              [GEN_AI_ATTRIBUTE.usageInputTokens]: settled.input,
              [GEN_AI_ATTRIBUTE.usageOutputTokens]: settled.output,
            },
    });
  }
  return spans;
}
