import { err, ok, type Namespace, type Result, type RunId } from "@custodian/domain-primitives";
import { GENESIS_HASH } from "../domain/append-entry";
import type { ExecutionLogStore, LogStoreFailure } from "../domain/execution-log-store";
import type { LoggedEntry } from "../domain/logged-entry";

export class InMemoryExecutionLogStore implements ExecutionLogStore {
  readonly #runs = new Map<string, readonly LoggedEntry[]>();

  append(
    namespace: Namespace,
    runId: RunId,
    entries: readonly LoggedEntry[],
  ): Promise<Result<void, LogStoreFailure>> {
    const stored = this.#runs.get(keyFor(namespace, runId)) ?? [];

    // The caller passes the whole run, so a shorter log is a deletion attempt and a diverging
    // prefix is a rewrite. Both are refused rather than merged.
    if (entries.length < stored.length) {
      const tail = stored.length - 1;
      return Promise.resolve(err({ kind: "sequence-rewind", tail, received: entries.length - 1 }));
    }

    const incoming = entries.slice(stored.length);
    const first = incoming[0];
    if (first === undefined) {
      return Promise.resolve(ok(undefined));
    }
    const expectedPrevious = stored.at(-1)?.hash ?? GENESIS_HASH;
    if (first.previousHash !== expectedPrevious) {
      const received = first.previousHash;
      return Promise.resolve(err({ kind: "chain-diverged", expectedPrevious, received }));
    }

    this.#runs.set(keyFor(namespace, runId), [...stored, ...incoming]);
    return Promise.resolve(ok(undefined));
  }

  read(
    namespace: Namespace,
    runId: RunId,
  ): Promise<Result<readonly LoggedEntry[], LogStoreFailure>> {
    const stored = this.#runs.get(keyFor(namespace, runId));
    return Promise.resolve(stored === undefined ? err({ kind: "unknown-run", runId }) : ok(stored));
  }
}

/** A namespace cannot contain a space and a run id cannot either, so no two keys collide. */
function keyFor(namespace: Namespace, runId: RunId): string {
  return `${namespace} ${runId}`;
}
