import type { SealedContent } from "@custodian/primitives";
import type { Namespace } from "@custodian/primitives";
import { expiresAtForDuration } from "@custodian/primitives";
import type { CacheKey } from "./cache-key";

export type CacheEntry = {
  readonly namespace: Namespace;
  readonly value: SealedContent;
  readonly storedAt: string;
  readonly expiresAt: string;
};

/**
 * A cached completion is a completion, so it takes the "prompts and completions" period rather than
 * living forever. Without this the cache was the one store with no retention at all — sealing made
 * it erasable on request, but nothing disposed of it on schedule.
 */
export function cacheEntryFor(
  namespace: Namespace,
  value: SealedContent,
  storedAt: string,
): CacheEntry {
  return {
    namespace,
    value,
    storedAt,
    expiresAt: expiresAtForDuration("prompts-and-completions", storedAt),
  };
}

/**
 * Cached completions hold SealedContent, never plaintext. The data map requires "key destruction
 * plus targeted invalidation by subject tag" for this location
 * (Data_Protection_and_Retention.txt:52-54); sealing satisfies it by construction, so destroying a
 * subject's key reaches the cache without the cache needing a per-subject index of its own.
 */
export interface ResponseCache {
  /** Returns nothing once the entry is past its retention period, even if it is still stored. */
  get(key: CacheKey, now: string): SealedContent | undefined;
  set(key: CacheKey, namespace: Namespace, value: SealedContent, storedAt: string): void;
  /**
   * Tenant-level invalidation, for the rollback runbook rather than for erasure. Cache invalidation
   * is a rollback step, not follow-up cleanup - a documented incident had the cache serving a bad
   * answer for forty minutes after the rollback (Reliability_and_Operations.txt:116-117).
   */
  invalidateNamespace(namespace: Namespace): number;
}
