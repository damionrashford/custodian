import type { Namespace } from "@custodian/knowledge-base";
import type { CacheKey } from "./cache-key";

export interface ResponseCache {
  get(key: CacheKey): string | undefined;
  set(key: CacheKey, namespace: Namespace, value: string): void;
  /**
   * Cache invalidation is a step in the rollback runbook, not follow-up cleanup. A documented
   * incident had the cache serving a bad answer for forty minutes after the rollback
   * (Reliability_and_Operations.txt:116-117).
   */
  invalidateNamespace(namespace: Namespace): number;
}
