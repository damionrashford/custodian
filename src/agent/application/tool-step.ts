import {
  err,
  ok,
  type KeyStoreFailure,
  type Result,
  type SealedContent,
} from "@custodian/primitives";
import { capToolOutput } from "@custodian/knowledge";
import { railRetrieved, type RetrievedChunk } from "../domain/retrieval-rail";
import { screen, type Classifier } from "../domain/screen";
import { namespaceFor } from "@custodian/knowledge";
import { bucketFor } from "@custodian/primitives";
import type { AgentStep } from "../domain/step";
import type { RetrievedRecord, Tool, ToolObservation } from "../domain/tool";
import {
  FAILED_COPY,
  type AgentRunDeps,
  type AgentRunFailure,
  type AgentRunRequest,
  type LoopContext,
} from "./agent-run";
import type { StepEffect } from "./progress";
import { appendEvents, retrievalEvents, toolCalled } from "./run-log";

/** Everything one tool step needs, bundled so the three paths below stay legible. */
export type ToolStepScope = {
  readonly step: Extract<AgentStep, { kind: "use-tool" }>;
  readonly context: LoopContext;
  readonly request: AgentRunRequest;
  readonly deps: AgentRunDeps;
};

export async function applyToolStep(
  scope: ToolStepScope,
): Promise<Result<StepEffect, AgentRunFailure>> {
  // Progressive disclosure: the full definition enters play only once the model reaches for the
  // tool by name (Agent_Architecture_Addendum.txt:145). The slice has one tool, so the definition
  // is not re-injected into context — that wiring lands with the second tool.
  const definition = await scope.deps.catalogue.define(scope.request.taskClass, scope.step.tool);
  const tool = scope.deps.tools.find((candidate) => candidate.name === scope.step.tool);
  return !definition.ok || tool === undefined ? recordDeniedTool(scope) : runTool(scope, tool);
}

function sealArguments(scope: ToolStepScope): Promise<Result<SealedContent, KeyStoreFailure>> {
  return scope.deps.keys.seal({
    subject: scope.request.subject,
    bucket: bucketFor("execution-log-content", scope.request.at()),
    plaintext: scope.step.argumentsJson,
  });
}

/**
 * An attempted call the agent could not make is still a tool call the record must show: field
 * group 4 asks what the agent did, and "reached for a tool it may not use" is an answer.
 */
async function recordDeniedTool(
  scope: ToolStepScope,
): Promise<Result<StepEffect, AgentRunFailure>> {
  const sealed = await sealArguments(scope);
  if (!sealed.ok) {
    return err({ kind: "failed", publicReason: FAILED_COPY });
  }
  const denied = appendEvents(
    [toolCalled(scope.step.tool, sealed.value, "denied")],
    scope.context,
    scope.request,
    scope.deps,
  );
  if (!denied.ok) {
    return denied;
  }
  scope.context.observations.push(capToolOutput(String(scope.step.tool), "Tool unavailable."));
  return ok({ kind: "tool-failed" });
}

async function runTool(
  scope: ToolStepScope,
  tool: Tool,
): Promise<Result<StepEffect, AgentRunFailure>> {
  const { context, deps, request } = scope;
  const sealedArgs = await sealArguments(scope);
  if (!sealedArgs.ok) {
    return err({ kind: "failed", publicReason: FAILED_COPY });
  }

  const executed = await tool.execute(scope.step.argumentsJson, namespaceFor(request.claim));
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

  const admitted = admittedRecords(executed.value.retrieved, deps.classifiers);
  const appended = appendEvents(
    retrievalEvents({
      tool: tool.name,
      sealedArguments: sealedArgs.value,
      blocked: admitted.blocked,
      admitted: admitted.records,
      screened: deps.classifiers.length > 0,
    }),
    context,
    request,
    deps,
  );
  if (!appended.ok) {
    return appended;
  }

  const hasNewEvidence = admitted.records.some((record) => !context.seen.has(record.recordId));
  for (const record of admitted.records) {
    context.seen.add(record.recordId);
  }
  context.observations.push(
    capToolOutput(
      String(tool.name),
      observationFor(executed.value, admitted, hasNewEvidence, deps),
    ),
  );
  return ok({ kind: hasNewEvidence ? "observed-new-evidence" : "observed-nothing-new" });
}

/**
 * Chunks are reconciled by identity, never by record id: a document chunked into several records
 * shares one id, so an id-keyed set re-admits the blocked chunk alongside its clean sibling — the
 * rail would log a block and hand the model the text anyway.
 */
type RailedRecords = {
  readonly records: readonly RetrievedRecord[];
  readonly blocked: ReturnType<typeof railRetrieved>["blocked"];
};

function admittedRecords(
  retrieved: readonly RetrievedRecord[],
  classifiers: readonly Classifier[],
): RailedRecords {
  const chunks = retrieved.map((record) => ({
    documentId: record.recordId,
    text: record.text,
  }));
  const railed = railRetrieved(chunks, classifiers);
  const admittedChunks = new Set<RetrievedChunk>(railed.admitted);
  const records = retrieved.filter((_, index) => {
    const chunk = chunks[index];
    return chunk !== undefined && admittedChunks.has(chunk);
  });
  return { records, blocked: railed.blocked };
}

/**
 * Context is rebuilt from railed records, so blocked text cannot ride in via the tool's own
 * observation string; that string is only trusted when nothing was retrieved at all, and is
 * screened in its own right. Re-retrieved evidence is summarised rather than re-pasted: a model
 * that searches the same thing twice would otherwise be re-billed for the same documents every
 * turn, with nothing in the transcript telling it that it already holds the answer.
 */
function observationFor(
  observed: ToolObservation,
  railed: RailedRecords,
  hasNewEvidence: boolean,
  deps: AgentRunDeps,
): string {
  if (railed.records.length === 0) {
    // Everything the tool found was withheld. Saying so beats a blank turn: the model cannot
    // otherwise tell "found nothing" from "found something it may not see", and would search again.
    return railed.blocked.length > 0
      ? WITHHELD_COPY
      : screenedObservation(observed.observation, deps.classifiers);
  }
  return hasNewEvidence
    ? railed.records.map((record) => record.text).join("\n")
    : "The search returned only records already retrieved in this run.";
}

const WITHHELD_COPY = "The tool's response was withheld by a safety policy.";

/** A tool's free-form observation is model-visible text, so it passes the same screen a record does. */
function screenedObservation(observation: string, classifiers: readonly Classifier[]): string {
  if (observation.length === 0 || classifiers.length === 0) {
    return observation;
  }
  return screen(observation, classifiers).kind === "block" ? WITHHELD_COPY : observation;
}
