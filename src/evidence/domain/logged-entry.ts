import type { ExecutionEvent } from "./execution-event";
import type { RunId } from "@custodian/primitives";

export type LoggedEntry = {
  readonly runId: RunId;
  readonly seq: number;
  readonly at: string;
  readonly previousHash: string;
  readonly hash: string;
  readonly event: ExecutionEvent;
};
