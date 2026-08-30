import { type Brand, err, ok, type Result, type SealedContent } from "@custodian/domain-primitives";

export type WorkflowId = Brand<string, "WorkflowId">;
export type StepName = Brand<string, "StepName">;

export type InvalidWorkflowId = { readonly kind: "invalid-workflow-id"; readonly received: string };

const WORKFLOW_ID_PATTERN = /^w_[0-9a-z]{26}$/;

export function parseWorkflowId(value: string): Result<WorkflowId, InvalidWorkflowId> {
  return WORKFLOW_ID_PATTERN.test(value)
    ? ok(value as WorkflowId)
    : err({ kind: "invalid-workflow-id", received: value });
}

/**
 * The engine is bought (LD-6), so it must never hold plaintext. A payload carries SealedContent
 * references only, which keeps the engine's storage location a small residency question and keeps
 * crypto-shred reaching engine-managed history by destroying the subject key.
 *
 * There is deliberately no way to put a plain string in here.
 */
export type WorkflowPayload = {
  readonly sealed: readonly SealedContent[];
  /** Non-personal routing metadata only — never prompt or tool-argument content. */
  readonly metadata: Readonly<Record<string, string>>;
};

/**
 * A durable workflow may outlive the API version that started it, so the definition carries its own
 * version plane, separate from the public API and the webhook payload
 * (Compliance_and_Certification.txt:98, 116).
 */
export type WorkflowDefinition = {
  readonly name: string;
  readonly version: number;
};

export type WorkflowFailure =
  | { readonly kind: "engine-unavailable"; readonly reason: string }
  | { readonly kind: "definition-retired"; readonly definition: WorkflowDefinition };

export interface WorkflowEngine {
  start(
    definition: WorkflowDefinition,
    payload: WorkflowPayload,
  ): Promise<Result<WorkflowId, WorkflowFailure>>;
  signal(id: WorkflowId, step: StepName): Promise<Result<void, WorkflowFailure>>;
}
