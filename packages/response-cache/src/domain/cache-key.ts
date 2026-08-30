import type { Brand } from "@custodian/domain-primitives";
import type { Namespace } from "@custodian/knowledge-base";

/**
 * Exact match only. Semantic caching is NOT built here and must not be added without an eval loop
 * measuring its false-positive rate: at the 0.93-0.95 thresholds needed for a hit rate above 30%,
 * a reported 3-7% of hits return the wrong answer (AI_Agent_Implementation_Plan_v2.txt:159-162).
 */
export type CacheKey = Brand<string, "CacheKey">;

/**
 * Hashing needs a runtime primitive and the domain layer imports none, so the capability is a port.
 * Same shape as the execution log's EntryHasher, deliberately - one way to hash in this codebase.
 */
export interface KeyDigest {
  digest(canonicalInput: string): string;
}

/**
 * The key is a digest, not the prompt. Building the key from the prompt in the clear would leave the
 * question readable in the cache index even after the answer is crypto-shredded - erasing the value
 * while the key still says what was asked is not erasure.
 */
export function cacheKeyFor(
  namespace: Namespace,
  model: string,
  prompt: string,
  digest: KeyDigest,
): CacheKey {
  return digest.digest(`${namespace} ${model} ${prompt}`) as CacheKey;
}
