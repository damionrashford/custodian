import type { SealedContent } from "@custodian/domain-primitives";
import type { Namespace } from "@custodian/knowledge-base";
import type { CacheKey } from "../domain/cache-key";
import { cacheEntryFor, type CacheEntry, type ResponseCache } from "../domain/response-cache";

export class InMemoryResponseCache implements ResponseCache {
  readonly #entries = new Map<string, CacheEntry>();

  get(key: CacheKey, now: string): SealedContent | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    // Past its period the entry is gone as far as any caller is concerned, and dropped on read so
    // an unswept cache cannot serve stale content while waiting for a sweeper to run.
    if (Date.parse(now) >= Date.parse(entry.expiresAt)) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: CacheKey, namespace: Namespace, value: SealedContent, storedAt: string): void {
    this.#entries.set(key, cacheEntryFor(namespace, value, storedAt));
  }

  invalidateNamespace(namespace: Namespace): number {
    let removed = 0;
    for (const [key, entry] of this.#entries) {
      if (entry.namespace === namespace) {
        this.#entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}
