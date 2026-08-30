import {
  canonicalJson,
  err,
  ok,
  type CompletionUsage,
  type ContentHasher,
  type Principal,
  type Region,
  type Result,
  type RunId,
  type SealedContent,
  type SubjectId,
  type ToolName,
} from "@custodian/domain-primitives";
import {
  evaluateLoop,
  type HaltReason,
  type LoopLimits,
  type RunState,
} from "@custodian/agent-loop";
import { resolve, type DeploymentLabel, type Registry } from "@custodian/config-registry";
import { capToolOutput, type ContextItem } from "@custodian/context-assembly";
import type { SubjectKeyStore } from "@custodian/crypto-shred";
import {
  appendEntry,
  type ExecutionEvent,
  type ExecutionLogStore,
  type LoggedEntry,
} from "@custodian/execution-log";
import { serveCompletion, type CompletionResponse, type ModelProvider } from "@custodian/gateway";
import { railRetrieved, type BlockedChunk, type Classifier } from "@custodian/guardrails";
import { parseRequestHash, type IdempotencyStore } from "@custodian/idempotency";
import { namespaceFor, type VerifiedTenantClaim } from "@custodian/knowledge-base";
import { bucketFor } from "@custodian/retention";
import type { ProviderProfile } from "@custodian/routing";
import type { TaskClass, ToolCatalogue, ToolSummary } from "@custodian/tool-registry";
import type { PromptSnapshot } from "@custodian/config-registry";
import { parseStep, type AgentStep } from "../domain/step";
import type { RetrievedRecord, Tool } from "../domain/tool";
import { advance, type StepEffect } from "./progress";

export type AgentRunRequest = {
  readonly runId: RunId;
  readonly principal: Principal;
  readonly claim: VerifiedTenantClaim;
  readonly tenantRegion: Region;
  readonly legalBasisPolicy: string;
  readonly requiresZeroRetention: boolean;
  readonly question: string;
  readonly subject: SubjectId;
  readonly deployment: DeploymentLabel;
  readonly taskClass: TaskClass;
  readonly limits: LoopLimits;
  readonly maxOutputTokens: number;
  readonly at: () => string;
  readonly jitter: number;
};

export type AgentRunDeps = {
  readonly registry: Registry;
  readonly catalogue: ToolCatalogue;
  readonly tools: readonly Tool[];
  readonly classifiers: readonly Classifier[];
  readonly logStore: ExecutionLogStore;
  readonly candidates: readonly ProviderProfile[];
  readonly providers: readonly ModelProvider[];
  readonly idempotency: IdempotencyStore;
  readonly keys: SubjectKeyStore;
  readonly hasher: ContentHasher;
  readonly costMicros: (usage: CompletionUsage) => number;
};

export type AgentAnswer = { readonly runId: RunId; readonly answer: string };

export type AgentRunFailure = {
  readonly kind: "halted" | "refused" | "failed";
  /** Plain-language and surface-safe; the interface layer returns it verbatim. */
  readonly publicReason: string;
};

const STOP_COPY =
  "The assistant stopped before finding an answer. Nothing was changed on your behalf.";

const HALT_COPY: Readonly<Record<HaltReason, string>> = {
  "iteration-ceiling": STOP_COPY,
  stagnating: STOP_COPY,
  "unverified-action": STOP_COPY,
  "cost-ceiling": "This request reached its cost limit before finding an answer.",
};

const REFUSED_COPY = "No provider in your region is available for this request.";
const ALREADY_COPY = "This request was already submitted.";
const FAILED_COPY = "The assistant could not complete this request.";

const CORRECTION =
  'Reply with exactly one JSON object: {"action":"use-tool","tool":"<name>","arguments":{...}} or {"action":"answer","text":"..."}.';

type LoopContext = {
  log: readonly LoggedEntry[];
  state: RunState;
  readonly observations: ContextItem[];
  readonly corrections: string[];
  readonly seen: Set<string>;
};

/**
 * The ReAct loop — C20's default mode ("start with ReAct and let observed failures dictate
 * graduation", Agent_Architecture_Addendum.txt:117) over the platform's existing parts. The loop
 * owns exactly the glue: the gateway owns provider calls and field groups 1/5/8, the rail owns
 * poisoned content, agent-loop owns the halt decision, and the log store owns the evidence. The
 * whole run's log persists every iteration, so a crash mid-run leaves a verifiable record rather
 * than nothing.
 */
export async function runAgent(
  request: AgentRunRequest,
  deps: AgentRunDeps,
): Promise<Result<AgentAnswer, AgentRunFailure>> {
  const snapshot = resolve(deps.registry, request.deployment);
  if (!snapshot.ok) {
    return err({ kind: "failed", publicReason: FAILED_COPY });
  }
  const summaries = await deps.catalogue.index(request.taskClass);
  if (!summaries.ok) {
    return err({ kind: "failed", publicReason: FAILED_COPY });
  }

  const context: LoopContext = {
    log: [],
    state: { iteration: 0, stepsWithoutStateChange: 0, costMicros: 0, lastActionVerified: true },
    observations: [],
    corrections: [],
    seen: new Set<string>(),
  };

  for (;;) {
    const verdict = evaluateLoop(context.state, request.limits);
    if (verdict.kind === "halt") {
      const finished = await finishRun("halted", context, request, deps);
      if (!finished.ok) {
        return finished;
      }
      return err({ kind: "halted", publicReason: HALT_COPY[verdict.reason] });
    }

    const served = await serveTurn(snapshot.value, summaries.value, context, request, deps);
    if (!served.ok) {
      return served;
    }
    const stepCost = deps.costMicros(served.value.usage);

    const step = parseStep(served.value.text);
    if (!step.ok) {
      // One sticky correction, not one per failure: N malformed replies would otherwise stack N
      // identical lines into every subsequent prompt.
      if (!context.corrections.includes(CORRECTION)) {
        context.corrections.push(CORRECTION);
      }
      context.state = advance(context.state, { kind: "step-unparseable" }, stepCost);
      const persisted = await persist(context, request, deps);
      if (!persisted.ok) {
        return persisted;
      }
      continue;
    }

    if (step.value.kind === "answer") {
      const finished = await finishRun("succeeded", context, request, deps);
      if (!finished.ok) {
        return finished;
      }
      return ok({ runId: request.runId, answer: step.value.text });
    }

    const effect = await applyToolStep(step.value, context, request, deps);
    if (!effect.ok) {
      return effect;
    }
    context.state = advance(context.state, effect.value, stepCost);
    const persisted = await persist(context, request, deps);
    if (!persisted.ok) {
      return persisted;
    }
  }
}

async function serveTurn(
  snapshot: PromptSnapshot,
  summaries: readonly ToolSummary[],
  context: LoopContext,
  request: AgentRunRequest,
  deps: AgentRunDeps,
): Promise<Result<CompletionResponse, AgentRunFailure>> {
  const hashed = parseRequestHash(
    deps.hasher.hash(
      canonicalJson({
        runId: request.runId,
        question: request.question,
        iteration: context.state.iteration,
      }),
    ),
  );
  if (!hashed.ok) {
    return err({ kind: "failed", publicReason: FAILED_COPY });
  }

  const served = await serveCompletion({
    runId: request.runId,
    principal: request.principal,
    claim: request.claim,
    tenantRegion: request.tenantRegion,
    legalBasisPolicy: request.legalBasisPolicy,
    requiresZeroRetention: request.requiresZeroRetention,
    prompt: snapshot,
    input: transcript(request.question, summaries, context),
    maxOutputTokens: request.maxOutputTokens,
    log: context.log,
    requestHash: hashed.value,
    candidates: deps.candidates,
    providers: deps.providers,
    idempotency: deps.idempotency,
    hasher: deps.hasher,
    at: request.at(),
    jitter: request.jitter,
    keys: deps.keys,
    subject: request.subject,
    costMicros: deps.costMicros,
  });

  if (!served.ok) {
    context.log = served.error.log;
    // A refusal is the event most in need of evidence; losing its record outranks the nicer copy.
    const persisted = await persist(context, request, deps);
    if (!persisted.ok) {
      return persisted;
    }
    const kind = served.error.rejection.kind;
    if (kind === "refused") {
      return err({ kind: "refused", publicReason: REFUSED_COPY });
    }
    if (kind === "already-served" || kind === "in-flight") {
      return err({ kind: "failed", publicReason: ALREADY_COPY });
    }
    return err({ kind: "failed", publicReason: FAILED_COPY });
  }
  context.log = served.value.log;
  return ok(served.value.response);
}

async function applyToolStep(
  step: Extract<AgentStep, { kind: "use-tool" }>,
  context: LoopContext,
  request: AgentRunRequest,
  deps: AgentRunDeps,
): Promise<Result<StepEffect, AgentRunFailure>> {
  // Progressive disclosure: the full definition enters play only once the model reaches for the
  // tool by name (Agent_Architecture_Addendum.txt:145). The slice has one tool, so the definition
  // is not re-injected into context — that wiring lands with the second tool.
  const definition = await deps.catalogue.define(request.taskClass, step.tool);
  const tool = deps.tools.find((candidate) => candidate.name === step.tool);
  if (!definition.ok || tool === undefined) {
    context.observations.push(capToolOutput(String(step.tool), "Tool unavailable."));
    return ok({ kind: "tool-failed" });
  }

  const sealedArgs = await deps.keys.seal({
    subject: request.subject,
    bucket: bucketFor("execution-log-content", request.at()),
    plaintext: step.argumentsJson,
  });
  if (!sealedArgs.ok) {
    const persisted = await persist(context, request, deps);
    return persisted.ok ? err({ kind: "failed", publicReason: FAILED_COPY }) : persisted;
  }

  const executed = await tool.execute(step.argumentsJson, namespaceFor(request.claim));
  if (!executed.ok) {
    const appended = appendEvents(
      [toolCalled(tool.name, sealedArgs.value, "failed")],
      context,
      request,
      deps,
    );
    if (!appended.ok) {
      return appended;
    }
    context.observations.push(capToolOutput(String(tool.name), "The tool could not complete."));
    return ok({ kind: "tool-failed" });
  }

  const railed = railRetrieved(
    executed.value.retrieved.map((record) => ({ documentId: record.recordId, text: record.text })),
    deps.classifiers,
  );
  const admittedIds = new Set(railed.admitted.map((chunk) => chunk.documentId));
  const admitted = executed.value.retrieved.filter((record) => admittedIds.has(record.recordId));

  const appended = appendEvents(
    retrievalEvents(tool.name, sealedArgs.value, railed.blocked, admitted),
    context,
    request,
    deps,
  );
  if (!appended.ok) {
    return appended;
  }

  const hasNewEvidence = admitted.some((record) => !context.seen.has(record.recordId));
  for (const record of admitted) {
    context.seen.add(record.recordId);
  }
  // Context is rebuilt from railed records, so blocked text cannot ride in via the tool's own
  // observation string; that string is only trusted when nothing was retrieved at all.
  const contextText =
    admitted.length > 0
      ? admitted.map((record) => record.text).join("\n")
      : executed.value.observation;
  context.observations.push(capToolOutput(String(tool.name), contextText));
  return ok({ kind: hasNewEvidence ? "observed-new-evidence" : "observed-nothing-new" });
}

function toolCalled(
  tool: ToolName,
  sealedArguments: SealedContent,
  status: "succeeded" | "failed",
): ExecutionEvent {
  return {
    kind: "tool-called",
    tool,
    arguments: sealedArguments,
    status,
    sideEffectsCommitted: [],
  };
}

/**
 * A successful tool call as log events, in the order the run performed them: every policy that
 * fired, every record that survived it, then the call itself.
 */
function retrievalEvents(
  tool: ToolName,
  sealedArguments: SealedContent,
  blocked: readonly BlockedChunk[],
  admitted: readonly RetrievedRecord[],
): readonly ExecutionEvent[] {
  return [
    ...blocked.map((blockedChunk): ExecutionEvent => ({
      kind: "guardrail-evaluated",
      policy: blockedChunk.verdict.policy,
      rule: blockedChunk.verdict.rule,
      outcome: "blocked",
    })),
    ...admitted.map((record): ExecutionEvent => ({
      kind: "record-retrieved",
      recordId: record.recordId,
      classification: record.classification,
      provenance: record.provenance,
    })),
    toolCalled(tool, sealedArguments, "succeeded"),
  ];
}

function transcript(
  question: string,
  summaries: readonly ToolSummary[],
  context: LoopContext,
): string {
  const toolIndex = summaries
    .map((summary) => `- ${String(summary.name)}: ${summary.summary}`)
    .join("\n");
  const observed = context.observations.flatMap((item) =>
    item.kind === "tool-output"
      ? [`Observation (${item.tool}${item.truncated ? ", truncated" : ""}): ${item.text}`]
      : [],
  );
  return [
    `Tools available:\n${toolIndex}`,
    `Question: ${question}`,
    ...observed,
    ...context.corrections,
  ].join("\n\n");
}

function appendEvents(
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

async function persist(
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

async function finishRun(
  outcome: "succeeded" | "halted",
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
