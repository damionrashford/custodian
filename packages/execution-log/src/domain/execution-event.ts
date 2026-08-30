import type {
  ModelSnapshot,
  Principal,
  PrincipalId,
  ProviderId,
  PromptVersion,
  Region,
  SealedContent,
  SubjectId,
  TenantId,
  ToolName,
} from "@custodian/domain-primitives";

/**
 * The eight field groups required per agent session by Compliance_and_Certification.txt:50-58.
 * Content that may contain personal data is a SealedContent reference, never a plaintext string —
 * that separation is what lets metadata survive 24 months while content expires at 30 days.
 */
export type ExecutionEvent =
  | {
      readonly kind: "run-started";
      readonly principal: Principal;
      readonly tenant: TenantId;
      readonly region: Region;
      readonly legalBasisPolicy: string;
      readonly request: SealedContent;
    }
  | {
      readonly kind: "record-retrieved";
      readonly recordId: string;
      readonly classification: "public" | "internal" | "confidential" | "personal";
      readonly provenance: "tenant-authored" | "user-supplied" | "external-untrusted";
    }
  | {
      readonly kind: "model-invoked";
      /**
       * One field, not a `model` and a `snapshot`: a pinned snapshot *is* the model identity, and
       * the pair was only ever written with the same value on both sides. Recording an alias
       * alongside it would defeat the reason snapshots are pinned — an entry on a rolling alias
       * cannot answer which side of a retirement date the call sat on.
       */
      readonly snapshot: ModelSnapshot;
      readonly promptVersion: PromptVersion;
      readonly routerDecision: ProviderId;
      readonly routerRationale: string;
    }
  | {
      readonly kind: "tool-called";
      readonly tool: ToolName;
      readonly arguments: SealedContent;
      readonly status: "succeeded" | "failed" | "denied";
      readonly sideEffectsCommitted: readonly string[];
    }
  | {
      readonly kind: "guardrail-evaluated";
      readonly policy: string;
      readonly rule: string;
      readonly outcome: "allowed" | "blocked";
    }
  | {
      readonly kind: "human-intervened";
      readonly reviewer: PrincipalId;
      readonly decision: "approved" | "rejected" | "timed-out";
      readonly requestedAt: string;
      readonly decidedAt: string;
    }
  | {
      readonly kind: "usage-recorded";
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly costMicros: number;
    }
  | {
      readonly kind: "run-finished";
      readonly outcome: "succeeded" | "failed" | "halted";
    };

/**
 * Subjects whose personal data an event touched, for the erasure data map. Any location not in the
 * map is a defect (Data_Protection_and_Retention.txt:92-93), so this switch is exhaustive by
 * construction — adding a variant breaks the build here first.
 */
export function subjectsIn(event: ExecutionEvent): readonly SubjectId[] {
  switch (event.kind) {
    case "run-started":
      return [event.request.subject];
    case "tool-called":
      return [event.arguments.subject];
    case "record-retrieved":
    case "model-invoked":
    case "guardrail-evaluated":
    case "human-intervened":
    case "usage-recorded":
    case "run-finished":
      return [];
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}
