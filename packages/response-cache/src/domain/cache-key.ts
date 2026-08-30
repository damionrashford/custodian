import { canonicalJson, type Brand } from "@custodian/domain-primitives";
import type { Namespace } from "@custodian/knowledge-base";

/**
 * Exact match only. Semantic caching is NOT built here and must not be added without an eval loop
 * measuring its false-positive rate: at the 0.93–0.95 thresholds needed for a hit rate above 30%,
 * a reported 3–7% of hits return the wrong answer. In a 10,000-query/day support workload that is
 * 90–200 users a day receiving confidently wrong answers the system believes are correct
 * (AI_Agent_Implementation_Plan_v2.txt:159-162).
 *
 * A false negative costs money; a false positive costs trust.
 */
export type CacheKey = Brand<string, "CacheKey">;

export function cacheKeyFor(namespace: Namespace, model: string, prompt: string): CacheKey {
  return canonicalJson({ namespace, model, prompt }) as CacheKey;
}
