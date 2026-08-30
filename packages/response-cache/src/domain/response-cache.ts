import type { SealedContent } from "@custodian/domain-primitives";
import type { Namespace } from "@custodian/knowledge-base";
import type { CacheKey } from "./cache-key";

/**
 * Cached completions hold SealedContent, never plaintext. The data map requires "key destruction
 * plus targeted invalidation by subject tag" for this location
 * (Data_Protection_and_Retention.txt:52-54); sealing satisfies it by construction, so destroying a
 * subject's key reaches the cache without the cache needing a per-subject index of its own.
 */
export interface ResponseCache {
  get(key: CacheKey): SealedContent | undefined;
  set(key: CacheKey, namespace: Namespace, value: SealedContent): void;
  /**
   * Tenant-level invalidation, for the rollback runbook rather than for erasure. Cache invalidation
   * is a rollback step, not follow-up cleanup - a documented incident had the cache serving a bad
   * answer for forty minutes after the rollback (Reliability_and_Operations.txt:116-117).
   */
  invalidateNamespace(namespace: Namespace): number;
}
