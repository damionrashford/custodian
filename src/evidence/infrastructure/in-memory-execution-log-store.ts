import { err, ok, type Namespace, type Result, type RunId } from "@custodian/primitives";
import { isDueForDisposal } from "@custodian/primitives";
import { validateAppend } from "../domain/append-entry";
import type { ExecutionLogStore, LogStoreFailure } from "../domain/execution-log-store";
import type { LoggedEntry } from "../domain/logged-entry";

export class InMemoryExecutionLogStore implements ExecutionLogStore {
  readonly #runs = new Map<string, readonly LoggedEntry[]>();
  readonly #disposed = new Set<string>();

  append(
    namespace: Namespace,
    runId: RunId,
    entries: readonly LoggedEntry[],
  ): Promise<Result<void, LogStoreFailure>> {
    const key = keyFor(namespace, runId);
    if (this.#disposed.has(key)) {
      return Promise.resolve(err({ kind: "run-disposed", runId }));
    }
    const stored = this.#runs.get(key) ?? [];
    const validated = validateAppend(stored.length, stored.at(-1)?.hash, entries);
    if (!validated.ok) {
      return Promise.resolve(validated);
    }
    if (validated.value.length > 0) {
      this.#runs.set(key, [...stored, ...validated.value]);
    }
    return Promise.resolve(ok(undefined));
  }

  read(
    namespace: Namespace,
    runId: RunId,
  ): Promise<Result<readonly LoggedEntry[], LogStoreFailure>> {
    const stored = this.#runs.get(keyFor(namespace, runId));
    return Promise.resolve(stored === undefined ? err({ kind: "unknown-run", runId }) : ok(stored));
  }

  disposeExpiredRuns(now: string): Promise<number> {
    let disposed = 0;
    for (const [key, stored] of this.#runs) {
      const lastAt = stored.at(-1)?.at;
      if (lastAt !== undefined && isDueForDisposal("execution-log-metadata", lastAt, now)) {
        this.#runs.delete(key);
        this.#disposed.add(key);
        disposed += 1;
      }
    }
    return Promise.resolve(disposed);
  }
}

/** A namespace cannot contain a space and a run id cannot either, so no two keys collide. */
function keyFor(namespace: Namespace, runId: RunId): string {
  return `${namespace} ${runId}`;
}
