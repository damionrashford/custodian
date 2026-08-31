import {
  err,
  ok,
  type KeyStoreFailure,
  type Result,
  type SealedContent,
} from "@custodian/primitives";
import { capToolOutput } from "@custodian/knowledge";
import { railRetrieved, type RetrievedChunk } from "../domain/retrieval-rail";
import type { Classifier } from "../domain/screen";
import { namespaceFor } from "@custodian/knowledge";
import { bucketFor } from "@custodian/primitives";
import { seekApproval } from "@custodian/governance";
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
  // tool by name (architecture-addendum.txt:145). The slice has one tool, so the definition
  // is not re-injected into context — that wiring lands with the second tool.
  const definition = await scope.deps.catalogue.define(scope.request.taskClass, scope.step.tool);
  const tool = scope.deps.tools.find((candidate) => candidate.name === scope.step.tool);
  if (!definition.ok || tool === undefined) {
    return recordDeniedTool(scope, "Tool unavailable.");
  }

  // Approval before execution, never after. A tool that has already written the file and is then
  // told no has not been reviewed, it has been audited — and the two are different products.
  const resolution = await seekApproval(tool.actionClass, scope.deps.approvals, scope.request.at());
  if (resolution.kind === "denied") {
    return recordDeniedTool(scope, DENIED_COPY[resolution.reason]);
  }
  return runTool(scope, tool);
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
/**
 * Plain-language, and it distinguishes the two denials because they call for different next moves:
 * a rejection means stop, a timeout means the queue is backed up and trying later may work. No
 * implementation language, per the interface vocabulary rules.
 */
const DENIED_COPY: Readonly<Record<"rejected" | "timed-out-fail-safe", string>> = {
  rejected: "A reviewer declined this action.",
  "timed-out-fail-safe": "This action needs approval and nobody was available to give it.",
};

async function recordDeniedTool(
  scope: ToolStepScope,
  copy: string,
): Promise<Result<StepEffect, AgentRunFailure>> {
  const sealed = await sealArguments(scope);
  if (!sealed.ok) {
    return err({ kind: "failed", publicReason: FAILED_COPY });
  }
  const denied = appendEvents(
    // Nothing committed: approval runs before execution, so a denied call did not happen.
    [
      toolCalled({
        tool: scope.step.tool,
        sealedArguments: sealed.value,
        status: "denied",
        committed: [],
      }),
    ],
    scope.context,
    scope.request,
    scope.deps,
  );
  if (!denied.ok) {
    return denied;
  }
  scope.context.observations.push(capToolOutput(String(scope.step.tool), copy));
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
    // A tool that returned a failure told us nothing about how far it got, so the record claims
    // nothing rather than guessing. This is the one entry where an empty list is a gap and saying
    // so is more honest than filling it — the tool's own failure shape is what would have to carry
    // partial-effect information, and none of them do yet.
    const appended = appendEvents(
      [
        toolCalled({
          tool: tool.name,
          sealedArguments: sealedArgs.value,
          status: "failed",
          committed: [],
        }),
      ],
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

  // An acting tool's bytes are railed like a retrieved chunk before any of it reaches the model.
  // A shell's stdout or a fetched page is content the model reads, which is the channel indirect
  // injection arrives through (implementation-plan.txt:229) — that this platform asked
  // for it makes it no more trustworthy than a document someone else wrote.
  const observation = executed.value;
  const admitted =
    observation.kind === "retrieved"
      ? admittedRecords(observation.retrieved, deps.classifiers)
      : admittedRecords(
          [
            {
              recordId: `${String(tool.name)}:output`,
              classification: "internal" as const,
              provenance: "external-untrusted" as const,
              text: observation.receipt.output,
            },
          ],
          deps.classifiers,
        );
  const appended = appendEvents(
    retrievalEvents({
      tool: tool.name,
      sealedArguments: sealedArgs.value,
      blocked: admitted.blocked,
      admitted: admitted.records,
      screened: deps.classifiers.length > 0,
      // Straight from the tool, never inferred here: only the adapter knows whether its action
      // changed anything, and a read and a write are both `acted` observations.
      committed: observation.kind === "acted" ? observation.receipt.committed : [],
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
    capToolOutput(String(tool.name), observationFor(observation, admitted, hasNewEvidence)),
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
): string {
  if (observed.kind === "acted") {
    // The summary is this platform's own words and needs no screening; the output has just been
    // through the rail, so a blocked one is reported rather than quietly dropped — a model that
    // cannot see whether its command ran will run it again.
    return railed.records.length === 0 && railed.blocked.length > 0
      ? `${observed.receipt.summary}\n${WITHHELD_COPY}`
      : [observed.receipt.summary, ...railed.records.map((record) => record.text)].join("\n");
  }
  if (railed.records.length === 0) {
    // Everything the tool found was withheld. Saying so beats a blank turn: the model cannot
    // otherwise tell "found nothing" from "found something it may not see", and would search again.
    return railed.blocked.length > 0 ? WITHHELD_COPY : "No matching records.";
  }
  return hasNewEvidence
    ? railed.records.map((record) => record.text).join("\n")
    : "The search returned only records already retrieved in this run.";
}

const WITHHELD_COPY = "The tool's response was withheld by a safety policy.";
