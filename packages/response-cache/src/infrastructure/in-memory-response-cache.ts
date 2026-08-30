import type { Namespace } from "@custodian/knowledge-base";
import type { CacheKey } from "../domain/cache-key";
import type { ResponseCache } from "../domain/response-cache";

type Entry = { readonly namespace: Namespace; readonly value: string };

export class InMemoryResponseCache implements ResponseCache {
  readonly #entries = new Map<string, Entry>();

  get(key: CacheKey): string | undefined {
    return this.#entries.get(key)?.value;
  }

  set(key: CacheKey, namespace: Namespace, value: string): void {
    this.#entries.set(key, { namespace, value });
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
