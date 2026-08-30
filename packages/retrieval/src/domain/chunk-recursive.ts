import type { TokenCounter } from "@custodian/domain-primitives";
import type { Chunk } from "./chunk";

export type ChunkingOptions = {
  readonly maxTokens: number;
  readonly overlapTokens: number;
  readonly countTokens: TokenCounter;
};

/**
 * Benchmark-validated baseline: recursive character splitting at 512 tokens with 50–100 tokens of
 * overlap, requiring no model calls (AI_Agent_Implementation_Plan_v2.txt:151). Chunking
 * configuration influences retrieval quality as much as or more than the choice of embedding model,
 * so this is a starting point for a sweep on our own corpus, not a settled answer.
 */
export const DEFAULT_MAX_TOKENS = 512;
export const DEFAULT_OVERLAP_TOKENS = 64;

/**
 * Separators in descending order of structural significance. Splitting recursively on the largest
 * boundary that fits is what keeps a sentence from being severed mid-clause — over-fragmentation and
 * evidence split across units are the two documented causes of degraded retrieval.
 */
const SEPARATORS: readonly string[] = ["\n\n", "\n", ". ", " "];

function splitOnce(text: string, separator: string): readonly string[] {
  const parts = text.split(separator);
  return parts.map((part, index) => (index === parts.length - 1 ? part : part + separator));
}

function split(text: string, options: ChunkingOptions, depth: number): readonly string[] {
  if (options.countTokens(text) <= options.maxTokens) {
    return text.length === 0 ? [] : [text];
  }

  const separator = SEPARATORS[depth];
  if (separator === undefined) {
    // No structural boundary left: cut on token budget so a chunk can never exceed the window.
    return hardSplit(text, options);
  }

  const pieces: string[] = [];
  let buffer = "";
  for (const part of splitOnce(text, separator)) {
    const candidate = buffer + part;
    if (buffer.length > 0 && options.countTokens(candidate) > options.maxTokens) {
      pieces.push(...split(buffer, options, depth + 1));
      buffer = part;
      continue;
    }
    buffer = candidate;
  }
  if (buffer.length > 0) {
    pieces.push(...split(buffer, options, depth + 1));
  }
  return pieces;
}

function hardSplit(text: string, options: ChunkingOptions): readonly string[] {
  const pieces: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let take = remaining.length;
    while (take > 1 && options.countTokens(remaining.slice(0, take)) > options.maxTokens) {
      take -= 1;
    }
    pieces.push(remaining.slice(0, take));
    remaining = remaining.slice(take);
  }
  return pieces;
}

/**
 * Overlap is measured in model tokens, not characters. A character-based splitter silently produces
 * oversized chunks for non-Latin scripts and code, which is the failure the token counter exists to
 * prevent.
 */
export function chunkRecursive(text: string, options: ChunkingOptions): readonly Chunk[] {
  // The carried overlap is prepended to the next piece, so the content budget has to leave room for
  // it. Splitting at the full budget and then adding overlap produces chunks that exceed the window
  // — the exact failure a token-measured splitter exists to prevent.
  const contentBudget = Math.max(1, options.maxTokens - options.overlapTokens);
  const pieces = split(text, { ...options, maxTokens: contentBudget }, 0);
  const chunks: Chunk[] = [];
  let startToken = 0;
  let carry = "";

  for (const piece of pieces) {
    const body = carry + piece;
    const tokenCount = options.countTokens(body);
    chunks.push({ text: body, startToken, tokenCount });

    carry = overlapSuffix(piece, options);
    startToken += tokenCount - options.countTokens(carry);
  }

  return chunks;
}

function overlapSuffix(piece: string, options: ChunkingOptions): string {
  if (options.overlapTokens <= 0) return "";
  let take = 0;
  while (
    take < piece.length &&
    options.countTokens(piece.slice(piece.length - take - 1)) <= options.overlapTokens
  ) {
    take += 1;
  }
  return piece.slice(piece.length - take);
}
