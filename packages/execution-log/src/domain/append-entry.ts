import {
  canonicalJson,
  type ContentHasher,
  err,
  ok,
  type Result,
} from "@custodian/domain-primitives";
import type { ExecutionEvent } from "./execution-event";
import type { LoggedEntry } from "./logged-entry";
import type { RunId } from "./run-id";

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
