import type { Brand, ContentHasher } from "@custodian/domain-primitives";
import type { Namespace } from "@custodian/knowledge-base";

/**
 * Exact match only. Semantic caching is NOT built here and must not be added without an eval loop
 * measuring its false-positive rate: at the 0.93-0.95 thresholds needed for a hit rate above 30%,
 * a reported 3-7% of hits return the wrong answer (AI_Agent_Implementation_Plan_v2.txt:159-162).
 */
export type CacheKey = Brand<string, "CacheKey">;

/**
 * The key is a digest, not the prompt. Building the key from the prompt in the clear would leave the
 * question readable in the cache index even after the answer is crypto-shredded - erasing the value
 * while the key still says what was asked is not erasure.
 */
export function cacheKeyFor(
  namespace: Namespace,
  model: string,
  prompt: string,
  hasher: ContentHasher,
): CacheKey {
  return hasher.hash(`${namespace} ${model} ${prompt}`) as CacheKey;
}
