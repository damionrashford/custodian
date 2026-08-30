import { canonicalJson, err, ok, type Result } from "@custodian/domain-primitives";
import { evaluateLoop } from "@custodian/agent-loop";
import { resolve, type PromptSnapshot } from "@custodian/config-registry";
import { serveCompletion, type CompletionResponse } from "@custodian/gateway";
import { parseRequestHash } from "@custodian/idempotency";
import type { ToolSummary } from "@custodian/tool-registry";
import { parseStep } from "../domain/step";
import {
  ALREADY_COPY,
  CORRECTION,
  FAILED_COPY,
  HALT_COPY,
  REFUSED_COPY,
  type AgentAnswer,
  type AgentRunDeps,
  type AgentRunFailure,
  type AgentRunRequest,
  type LoopContext,
} from "./agent-run";
import { advance } from "./progress";
import { closeFailed, finishRun, persist } from "./run-log";
import { applyToolStep } from "./tool-step";

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
      return finished.ok
        ? err({ kind: "halted", publicReason: HALT_COPY[verdict.reason] })
        : finished;
    }

    const served = await serveTurn(snapshot.value, summaries.value, context, request, deps);
    if (!served.ok) {
      return closeFailed(served.error, context, request, deps);
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
      // No advance() here on purpose: the run ends, and nothing reads the tally afterwards. The
      // cost of this turn is in the log where reconciliation looks for it (the gateway writes
      // usage-recorded per call); folding it into loop state as well would be bookkeeping no
      // test could observe — a line that cannot be proven wrong is a line that is not carrying.
      const finished = await finishRun("succeeded", context, request, deps);
      return finished.ok ? ok({ runId: request.runId, answer: step.value.text }) : finished;
    }

    const effect = await applyToolStep({ step: step.value, context, request, deps });
    if (!effect.ok) {
      return closeFailed(effect.error, context, request, deps);
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
  // The turn hash is scoped to the run: the same question asked by a different run is new work,
  // and the same question at a different iteration is a different turn.
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
    // The caller closes the run: a refusal is the event most in need of evidence, and a log that
    // stops without a terminal entry is indistinguishable from one truncated by tampering.
    context.log = served.error.log;
    const kind = served.error.rejection.kind;
    if (kind === "refused") {
      return err({ kind: "refused", publicReason: REFUSED_COPY });
    }
    if (kind === "already-served" || kind === "in-flight") {
      return err({ kind: "already-served", publicReason: ALREADY_COPY });
    }
    return err({ kind: "failed", publicReason: FAILED_COPY });
  }
  context.log = served.value.log;
  return ok(served.value.response);
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
