import {
  canonicalJson,
  type RunId,
  type ContentHasher,
  err,
  ok,
  type Result,
} from "@custodian/primitives";
import type { ExecutionEvent } from "./execution-event";
import type { LogStoreFailure } from "./execution-log-store";
import type { LoggedEntry } from "./logged-entry";

export const GENESIS_HASH = "0".repeat(64);

export type AppendFailure = {
  readonly kind: "run-already-finished";
  readonly runId: RunId;
};

export type AppendContext = {
  readonly runId: RunId;
  readonly at: string;
  readonly hasher: ContentHasher;
};

export function hashableEntry(entry: Omit<LoggedEntry, "hash">): string {
  return canonicalJson({
    runId: entry.runId,
    seq: entry.seq,
    at: entry.at,
    previousHash: entry.previousHash,
    event: entry.event,
  });
}

/**
 * The write-time refusal every ExecutionLogStore adapter applies, in one place so adapters cannot
 * drift apart on the check that makes the store append-only. The caller passes the whole run: a
 * shorter log is a deletion attempt, a diverging continuation is a rewrite, and both are refused
 * rather than merged (compliance-and-certification.txt:59). Returns the entries actually new to
 * the store.
 */
export function validateAppend(
  storedCount: number,
  tailHash: string | undefined,
  entries: readonly LoggedEntry[],
): Result<readonly LoggedEntry[], LogStoreFailure> {
  if (entries.length < storedCount) {
    return err({ kind: "sequence-rewind", tail: storedCount - 1, received: entries.length - 1 });
  }
  const incoming = entries.slice(storedCount);
  const first = incoming[0];
  if (first === undefined) {
    return ok([]);
  }
  const expectedPrevious = tailHash ?? GENESIS_HASH;
  if (first.previousHash !== expectedPrevious) {
    return err({ kind: "chain-diverged", expectedPrevious, received: first.previousHash });
  }
  return ok(incoming);
}

export function appendEntry(
  log: readonly LoggedEntry[],
  event: ExecutionEvent,
  context: AppendContext,
): Result<readonly LoggedEntry[], AppendFailure> {
  const last = log.at(-1);
  if (last !== undefined && last.event.kind === "run-finished") {
    return err({ kind: "run-already-finished", runId: context.runId });
  }

  const unhashed = {
    runId: context.runId,
    seq: log.length,
    at: context.at,
    previousHash: last?.hash ?? GENESIS_HASH,
    event,
  };
  return ok([...log, { ...unhashed, hash: context.hasher.hash(hashableEntry(unhashed)) }]);
}
