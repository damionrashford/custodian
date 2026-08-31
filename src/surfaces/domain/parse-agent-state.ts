import { err, isRecord, ok, parseToolName, type Result } from "@custodian/primitives";
import type { InvalidToolName } from "@custodian/primitives";
import type { AgentState, AgentStateKind } from "./agent-state";
import {
  readBoolean,
  readCount,
  readOptionalCount,
  readOptionalString,
  readString,
  readStringArray,
  type WireRejection,
} from "./wire-value";

export type StateRejection =
  | WireRejection
  | InvalidToolName
  | { readonly kind: "unknown-state"; readonly received: string }
  /**
   * `AgentState` types `position` and `expectedStartAt` as `number | undefined` and
   * `string | undefined` because TypeScript cannot say "at least one of these". The obligation is
   * real anyway — `interface-standards.txt:178` forbids a bare indeterminate spinner — so
   * the wire is where it is enforced. A queued state that can say neither is one no surface may
   * render honestly, and refusing it here is louder than shipping it and hoping the UI copes.
   */
  | { readonly kind: "queued-without-position-or-start" };

type StateParser = (source: Record<string, unknown>) => Result<AgentState, StateRejection>;

function parseQueued(source: Record<string, unknown>): Result<AgentState, StateRejection> {
  const position = readOptionalCount(source, "position");
  if (!position.ok) {
    return position;
  }
  const expectedStartAt = readOptionalString(source, "expectedStartAt");
  if (!expectedStartAt.ok) {
    return expectedStartAt;
  }
  if (position.value === undefined && expectedStartAt.value === undefined) {
    return err({ kind: "queued-without-position-or-start" });
  }
  return ok({ kind: "queued", position: position.value, expectedStartAt: expectedStartAt.value });
}

function parseThinking(source: Record<string, unknown>): Result<AgentState, StateRejection> {
  const objective = readString(source, "objective");
  return objective.ok ? ok({ kind: "thinking", objective: objective.value }) : objective;
}

function parseActing(source: Record<string, unknown>): Result<AgentState, StateRejection> {
  const name = readString(source, "tool");
  if (!name.ok) {
    return name;
  }
  const tool = parseToolName(name.value);
  if (!tool.ok) {
    return tool;
  }
  const subject = readString(source, "subject");
  if (!subject.ok) {
    return subject;
  }
  const scope = readString(source, "scope");
  return scope.ok
    ? ok({ kind: "acting", tool: tool.value, subject: subject.value, scope: scope.value })
    : scope;
}

function parseAwaitingApproval(
  source: Record<string, unknown>,
): Result<AgentState, StateRejection> {
  const onApproval = readString(source, "onApproval");
  if (!onApproval.ok) {
    return onApproval;
  }
  const onRejection = readString(source, "onRejection");
  if (!onRejection.ok) {
    return onRejection;
  }
  const decideBy = readOptionalString(source, "decideBy");
  return decideBy.ok
    ? ok({
        kind: "awaiting-approval",
        onApproval: onApproval.value,
        onRejection: onRejection.value,
        decideBy: decideBy.value,
      })
    : decideBy;
}

function parseStreaming(source: Record<string, unknown>): Result<AgentState, StateRejection> {
  const partial = readString(source, "partial");
  return partial.ok ? ok({ kind: "streaming", partial: partial.value }) : partial;
}

function parseRecovering(source: Record<string, unknown>): Result<AgentState, StateRejection> {
  const attempt = readCount(source, "attempt");
  if (!attempt.ok) {
    return attempt;
  }
  const ofAttempts = readCount(source, "ofAttempts");
  if (!ofAttempts.ok) {
    return ofAttempts;
  }
  const costReincurred = readBoolean(source, "costReincurred");
  return costReincurred.ok
    ? ok({
        kind: "recovering",
        attempt: attempt.value,
        ofAttempts: ofAttempts.value,
        costReincurred: costReincurred.value,
      })
    : costReincurred;
}

function parseFailed(source: Record<string, unknown>): Result<AgentState, StateRejection> {
  const whatFailed = readString(source, "whatFailed");
  if (!whatFailed.ok) {
    return whatFailed;
  }
  const atStep = readString(source, "atStep");
  if (!atStep.ok) {
    return atStep;
  }
  const alreadyCommitted = readStringArray(source, "alreadyCommitted");
  if (!alreadyCommitted.ok) {
    return alreadyCommitted;
  }
  const nextAction = readString(source, "nextAction");
  return nextAction.ok
    ? ok({
        kind: "failed",
        whatFailed: whatFailed.value,
        atStep: atStep.value,
        alreadyCommitted: alreadyCommitted.value,
        nextAction: nextAction.value,
      })
    : nextAction;
}

/**
 * Typed over `AgentStateKind` rather than `string`, so adding an eighth state fails to compile here
 * until it has a parser — the compiler doing the work a `never` default would otherwise do.
 */
const PARSERS: Readonly<Record<AgentStateKind, StateParser>> = {
  queued: parseQueued,
  thinking: parseThinking,
  acting: parseActing,
  "awaiting-approval": parseAwaitingApproval,
  streaming: parseStreaming,
  recovering: parseRecovering,
  failed: parseFailed,
};

/**
 * Read back through a map keyed by plain strings. Indexing `PARSERS` with an unvalidated string
 * would need an assertion; going via `Object.entries` keeps the exhaustiveness above and still
 * yields `undefined` for a kind that does not exist.
 */
const BY_KIND: ReadonlyMap<string, StateParser> = new Map(Object.entries(PARSERS));

export function parseAgentState(raw: unknown): Result<AgentState, StateRejection> {
  if (!isRecord(raw)) {
    return err({ kind: "field-malformed", field: "state" });
  }
  const kind = raw["kind"];
  if (typeof kind !== "string") {
    return err({ kind: "field-malformed", field: "state.kind" });
  }
  const parser = BY_KIND.get(kind);
  return parser === undefined ? err({ kind: "unknown-state", received: kind }) : parser(raw);
}
