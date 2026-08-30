import {
  err,
  ok,
  type Result,
  type SealedContent,
  type ToolName,
} from "@custodian/domain-primitives";
import { appendEntry, type ExecutionEvent } from "@custodian/execution-log";
import type { BlockedChunk } from "@custodian/guardrails";
import { namespaceFor } from "@custodian/knowledge-base";
import type { RetrievedRecord } from "../domain/tool";
import {
  FAILED_COPY,
  type AgentAnswer,
  type AgentRunDeps,
  type AgentRunFailure,
  type AgentRunRequest,
  type LoopContext,
} from "./agent-run";

export function toolCalled(
  tool: ToolName,
  sealedArguments: SealedContent,
  status: "succeeded" | "failed" | "denied",
): ExecutionEvent {
  return {
    kind: "tool-called",
    tool,
    arguments: sealedArguments,
    status,
    sideEffectsCommitted: [],
  };
}

export type RetrievalOutcome = {
  readonly tool: ToolName;
  readonly sealedArguments: SealedContent;
  readonly blocked: readonly BlockedChunk[];
  readonly admitted: readonly RetrievedRecord[];
  /** False when no classifier ran, so no "allowed" entry claims a screening that never happened. */
  readonly screened: boolean;
};

/**
 * A successful tool call as log events, in the order the run performed them: every policy that
 * fired, every record that survived it, then the call itself.
 */
export function retrievalEvents(outcome: RetrievalOutcome): readonly ExecutionEvent[] {
  return [
    ...outcome.blocked.map((blockedChunk): ExecutionEvent => ({
      kind: "guardrail-evaluated",
      policy: blockedChunk.verdict.policy,
      rule: blockedChunk.verdict.rule,
      outcome: "blocked",
    })),
    // Only when a classifier ran: "screened and passed" and "never screened" are different facts,
    // and an allowed entry written with no classifier configured would assert the wrong one.
    ...(outcome.screened
      ? outcome.admitted.map((): ExecutionEvent => ({
          kind: "guardrail-evaluated",
          policy: "retrieval-rail",
          rule: "all-classifiers-passed",
          outcome: "allowed",
        }))
      : []),
    ...outcome.admitted.map((record): ExecutionEvent => ({
      kind: "record-retrieved",
      recordId: record.recordId,
      classification: record.classification,
      provenance: record.provenance,
    })),
    toolCalled(outcome.tool, outcome.sealedArguments, "succeeded"),
  ];
}

export function appendEvents(
  events: readonly ExecutionEvent[],
  context: LoopContext,
  request: AgentRunRequest,
  deps: AgentRunDeps,
): Result<void, AgentRunFailure> {
  for (const event of events) {
    const appended = appendEntry(context.log, event, {
      runId: request.runId,
      at: request.at(),
      hasher: deps.hasher,
    });
    if (!appended.ok) {
      return err({ kind: "failed", publicReason: FAILED_COPY });
    }
    context.log = appended.value;
  }
  return ok(undefined);
}

export async function persist(
  context: LoopContext,
  request: AgentRunRequest,
  deps: AgentRunDeps,
): Promise<Result<void, AgentRunFailure>> {
  const stored = await deps.logStore.append(
    namespaceFor(request.claim),
    request.runId,
    context.log,
  );
  return stored.ok ? ok(undefined) : err({ kind: "failed", publicReason: FAILED_COPY });
}

export async function finishRun(
  outcome: "succeeded" | "halted" | "failed" | "refused",
  context: LoopContext,
  request: AgentRunRequest,
  deps: AgentRunDeps,
): Promise<Result<void, AgentRunFailure>> {
  const appended = appendEvents([{ kind: "run-finished", outcome }], context, request, deps);
  if (!appended.ok) {
    return appended;
  }
  return persist(context, request, deps);
}

/**
 * Every terminal exit closes the run, with one exception the code cannot close: a persistence
 * failure means the store itself is unreachable, so there is nothing left to write the closing
 * entry with. Otherwise a log that ends without run-finished is, by the durable store's own
 * documented limit, indistinguishable from one truncated by tampering — so the outcome the caller
 * sees and the outcome the record shows are written together.
 */
export async function closeFailed(
  failure: AgentRunFailure,
  context: LoopContext,
  request: AgentRunRequest,
  deps: AgentRunDeps,
): Promise<Result<AgentAnswer, AgentRunFailure>> {
  const outcome = failure.kind === "refused" ? "refused" : "failed";
  const finished = await finishRun(outcome, context, request, deps);
  return finished.ok ? err(failure) : finished;
}
