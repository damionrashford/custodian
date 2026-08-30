import type { ContentHasher, SealedContent, SubjectId } from "@custodian/primitives";
import type { ExecutionEvent } from "../domain/execution-event";
import { subjectsIn } from "../domain/execution-event";
import type { LoggedEntry } from "../domain/logged-entry";
import type {
  AgentState,
  ChainIntegrity,
  InvocationCost,
  RunCost,
  RunTimeline,
  SealedContentRef,
  StateSpan,
  StepDetail,
  TimelineStep,
} from "../domain/run-timeline";
import { verifyRunLog } from "../domain/verify-run-log";

function sealedRef(content: SealedContent): SealedContentRef {
  return {
    subject: content.subject,
    bucket: content.bucket,
    sealedLength: content.ciphertext.length,
  };
}

/**
 * The two content-bearing events lose their ciphertext to a reference; everything else is metadata
 * already. The fall-through is the load-bearing half: a new execution event has to be assignable to
 * `StepDetail`, so one carrying `SealedContent` fails to compile here rather than reaching a screen.
 */
function detailFrom(event: ExecutionEvent): StepDetail {
  if (event.kind === "run-started") {
    return {
      kind: "run-started",
      principal: event.principal,
      tenant: event.tenant,
      region: event.region,
      legalBasisPolicy: event.legalBasisPolicy,
      request: sealedRef(event.request),
    };
  }
  if (event.kind === "tool-called") {
    return {
      kind: "tool-called",
      tool: event.tool,
      arguments: sealedRef(event.arguments),
      status: event.status,
      sideEffectsCommitted: event.sideEffectsCommitted,
    };
  }
  return event;
}

/**
 * The state an entry places the run in, before the recovery latch is applied. Two events change no
 * state: a guardrail evaluation happens inside whatever the run was already doing, and a usage
 * settlement is accounting. A run that finished any way other than `failed` closes on the state it
 * was already in — `refused` in particular is correct behaviour and not a failure.
 */
function baseStateFor(event: ExecutionEvent): AgentState | undefined {
  switch (event.kind) {
    case "run-started":
      return "queued";
    case "record-retrieved":
    case "model-invoked":
      return "thinking";
    case "tool-called":
      return "acting";
    case "human-intervened":
      return "awaiting-approval";
    case "guardrail-evaluated":
    case "usage-recorded":
      return undefined;
    case "run-finished":
      return event.outcome === "failed" ? "failed" : undefined;
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

/**
 * A run is recovering from the moment a tool call fails until the next one does not. A `denied`
 * call is not a fault — the rail refused it and the run is still on its intended path — so only
 * `failed` arms the latch.
 */
function nextRecovering(current: boolean, event: ExecutionEvent): boolean {
  if (event.kind === "tool-called") {
    return event.status === "failed";
  }
  return event.kind === "run-finished" ? false : current;
}

function statesFrom(log: readonly LoggedEntry[]): readonly StateSpan[] {
  const spans: { state: AgentState; at: string; fromSeq: number; toSeq: number }[] = [];
  let recovering = false;

  for (const entry of log) {
    const base = baseStateFor(entry.event);
    const state = recovering && (base === "thinking" || base === "acting") ? "recovering" : base;
    recovering = nextRecovering(recovering, entry.event);
    if (state === undefined) {
      continue;
    }
    const open = spans.at(-1);
    if (open !== undefined && open.state === state) {
      open.toSeq = entry.seq;
    } else {
      spans.push({ state, at: entry.at, fromSeq: entry.seq, toSeq: entry.seq });
    }
  }
  return spans;
}

type Invocation = Extract<ExecutionEvent, { kind: "model-invoked" }>;
type Settlement = {
  settlements: number;
  inputTokens: number;
  outputTokens: number;
  micros: number;
};
type Settled = {
  readonly byInvocation: ReadonlyMap<number, Settlement>;
  readonly totalMicros: number;
  readonly unattributedMicros: number;
  readonly unattributedSeqs: readonly number[];
};

const NOTHING_SETTLED: Settlement = {
  settlements: 0,
  inputTokens: 0,
  outputTokens: 0,
  micros: 0,
};

function invocationsIn(log: readonly LoggedEntry[]): ReadonlyMap<number, Invocation> {
  const invocations = new Map<number, Invocation>();
  for (const entry of log) {
    if (entry.event.kind === "model-invoked") {
      invocations.set(entry.seq, entry.event);
    }
  }
  return invocations;
}

function settle(
  log: readonly LoggedEntry[],
  invocations: ReadonlyMap<number, Invocation>,
): Settled {
  const byInvocation = new Map<number, Settlement>();
  const unattributedSeqs: number[] = [];
  let unattributedMicros = 0;
  let totalMicros = 0;

  for (const entry of log) {
    if (entry.event.kind !== "usage-recorded") {
      continue;
    }
    totalMicros += entry.event.costMicros;
    if (!invocations.has(entry.event.invocationSeq)) {
      unattributedSeqs.push(entry.seq);
      unattributedMicros += entry.event.costMicros;
      continue;
    }
    const prior = byInvocation.get(entry.event.invocationSeq) ?? NOTHING_SETTLED;
    byInvocation.set(entry.event.invocationSeq, {
      settlements: prior.settlements + 1,
      inputTokens: prior.inputTokens + entry.event.inputTokens,
      outputTokens: prior.outputTokens + entry.event.outputTokens,
      micros: prior.micros + entry.event.costMicros,
    });
  }
  return { byInvocation, totalMicros, unattributedMicros, unattributedSeqs };
}

function costFrom(log: readonly LoggedEntry[]): RunCost {
  const invocations = invocationsIn(log);
  const settled = settle(log, invocations);

  const perInvocation: InvocationCost[] = [];
  for (const [invocationSeq, event] of invocations) {
    const total = settled.byInvocation.get(invocationSeq) ?? NOTHING_SETTLED;
    perInvocation.push({
      invocationSeq,
      snapshot: event.snapshot,
      routerDecision: event.routerDecision,
      settlements: total.settlements,
      inputTokens: total.inputTokens,
      outputTokens: total.outputTokens,
      costMicros: total.micros,
    });
  }

  return {
    perInvocation,
    totalMicros: settled.totalMicros,
    unattributedMicros: settled.unattributedMicros,
    unattributedSeqs: settled.unattributedSeqs,
  };
}

function integrityFrom(log: readonly LoggedEntry[], hasher: ContentHasher): ChainIntegrity {
  const verified = verifyRunLog(log, hasher);
  return verified.ok ? { kind: "verified" } : { kind: "broken", failure: verified.error };
}

function outcomeFrom(log: readonly LoggedEntry[]): RunTimeline["outcome"] {
  const last = log.at(-1);
  return last !== undefined && last.event.kind === "run-finished"
    ? last.event.outcome
    : "in-flight";
}

function subjectsFrom(log: readonly LoggedEntry[]): readonly SubjectId[] {
  const subjects = new Set<SubjectId>();
  for (const entry of log) {
    for (const subject of subjectsIn(entry.event)) {
      subjects.add(subject);
    }
  }
  return [...subjects];
}

/**
 * The execution log as something a human can act on: the states the run passed through, every step
 * in sequence, cost settled per invocation, and whether the chain verifies. O1 in the surface map,
 * over the artefact CLAUDE.md calls the highest-leverage component in the programme — currently a
 * hash-chained table nobody can read.
 *
 * Pure, and deliberately without a key store. Content stays sealed: each step reports that content
 * exists, which keys would open it and how long it is, and never what it says. An entry whose
 * subject key has since been destroyed projects exactly like one whose key still exists, because
 * destroying a key does not change a byte of the entry — so an erased subject's steps stay in the
 * timeline as present-and-unreadable. Dropping them would be worse than useless: the reader would
 * lose the ability to see that the run happened at all, and erasure would have quietly rewritten
 * the evidence record it is supposed to leave standing.
 *
 * There is no nesting of retrievals or guardrail evaluations under the tool call they relate to.
 * The log records exactly one association between entries — a usage settlement names its
 * `invocationSeq` — and it records it explicitly because inferring it from adjacency
 * mis-attributes the moment a run makes more than one attempt. Nothing links a retrieval to a tool
 * call, so this returns them in sequence, each carrying its `seq`, and leaves the causal claim
 * unmade rather than guessing it in the one artefact that has to be right.
 */
export function projectRunTimeline(
  log: readonly LoggedEntry[],
  hasher: ContentHasher,
): RunTimeline {
  const steps: TimelineStep[] = log.map((entry) => ({
    seq: entry.seq,
    at: entry.at,
    detail: detailFrom(entry.event),
  }));

  return {
    runId: log[0]?.runId,
    integrity: integrityFrom(log, hasher),
    subjects: subjectsFrom(log),
    outcome: outcomeFrom(log),
    states: statesFrom(log),
    steps,
    cost: costFrom(log),
  };
}
