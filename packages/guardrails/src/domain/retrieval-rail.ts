import { screen, type Classifier, type GuardrailVerdict } from "./screen";

/**
 * The RAG-specific gap, and the reason this module exists separately from `screen`.
 *
 * Indirect injection arrives through content the model *reads* — a retrieved document, a fetched
 * page, a tool result — and input-only classifiers do not catch it. A retrieval rail that filters or
 * truncates context chunks before they enter the prompt is required, not optional
 * (AI_Agent_Implementation_Plan_v2.txt:229).
 *
 * Screening the user's message and calling that "guardrails" is precisely the deployment this
 * finding describes as unprotected.
 */
export type RetrievedChunk = {
  readonly documentId: string;
  readonly text: string;
};

export type BlockedChunk = {
  readonly chunk: RetrievedChunk;
  readonly verdict: Extract<GuardrailVerdict, { kind: "block" }>;
};

export type RailResult = {
  /** Only these may enter the prompt. */
  readonly admitted: readonly RetrievedChunk[];
  /** Recorded so the execution log carries which policies fired and what was blocked. */
  readonly blocked: readonly BlockedChunk[];
};

export function railRetrieved(
  chunks: readonly RetrievedChunk[],
  classifiers: readonly Classifier[],
): RailResult {
  const admitted: RetrievedChunk[] = [];
  const blocked: BlockedChunk[] = [];

  for (const chunk of chunks) {
    const verdict = screen(chunk.text, classifiers);
    if (verdict.kind === "block") {
      blocked.push({ chunk, verdict });
      continue;
    }
    admitted.push(chunk);
  }

  return { admitted, blocked };
}
