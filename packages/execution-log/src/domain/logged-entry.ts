import type { ExecutionEvent } from "./execution-event";
import type { RunId } from "./run-id";

export type LoggedEntry = {
  readonly runId: RunId;
  readonly seq: number;
  readonly at: string;
  readonly previousHash: string;
  readonly hash: string;
  readonly event: ExecutionEvent;
};
