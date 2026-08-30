import type { MemoryEntry, Provenance } from "./memory-entry";

/**
 * Do not score recall on embedding similarity alone. The influential design weighs recency
 * (exponential decay), relevance (similarity) and importance (self-assessed); this platform adds a
 * fourth term — provenance — so untrusted-origin entries are demoted at retrieval rather than only
 * at write (Agent_Architecture_Addendum.txt:152).
 *
 * Retrieving the wrong memory is indistinguishable to the model from having no memory, and worse
 * than none when the memory is stale.
 */
export type RecallWeights = {
  readonly recency: number;
  readonly relevance: number;
  readonly importance: number;
  readonly provenance: number;
};

export const DEFAULT_RECALL_WEIGHTS: RecallWeights = {
  recency: 0.25,
  relevance: 0.4,
  importance: 0.2,
  provenance: 0.15,
};

const HALF_LIFE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function provenanceScore(provenance: Provenance): number {
  switch (provenance) {
    case "authenticated-user":
      return 1;
    case "tenant-authored":
      return 0.7;
    case "external-untrusted":
      return 0;
    default: {
      const unhandled: never = provenance;
      return unhandled;
    }
  }
}

export type RecallInput = {
  readonly entry: MemoryEntry;
  readonly relevance: number;
  readonly now: string;
  readonly weights: RecallWeights;
};

export function scoreRecall(input: RecallInput): number {
  const ageDays = (Date.parse(input.now) - Date.parse(input.entry.writtenAt)) / DAY_MS;
  const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);

  return (
    recency * input.weights.recency +
    input.relevance * input.weights.relevance +
    input.entry.importance * input.weights.importance +
    provenanceScore(input.entry.provenance) * input.weights.provenance
  );
}

/**
 * Decay handles low-relevance memories. A high-relevance memory that has become false is
 * confidently retrieved and confidently wrong, so factual entries expire on a schedule rather than
 * being left to decay (Agent_Architecture_Addendum.txt:153). Twelve months rolling overall
 * (Data_Protection_and_Retention.txt:132-134).
 */
export const MEMORY_RETENTION_DAYS = 365;
export const FACT_EXPIRY_DAYS = 90;

export function isStale(entry: MemoryEntry, now: string): boolean {
  const ageDays = (Date.parse(now) - Date.parse(entry.writtenAt)) / DAY_MS;
  const limit = entry.category === "fact" ? FACT_EXPIRY_DAYS : MEMORY_RETENTION_DAYS;
  return ageDays > limit;
}
