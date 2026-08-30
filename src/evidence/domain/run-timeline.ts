import type {
  ModelSnapshot,
  Principal,
  PrincipalId,
  PromptVersion,
  ProviderId,
  Region,
  RetentionBucket,
  RunId,
  SubjectId,
  TenantId,
  ToolName,
} from "@custodian/primitives";
import type { LogIntegrityFailure } from "./verify-run-log";

/**
 * The seven states every interface must design, including failure and recovery
 * (Design_Interface_Standards.txt:174-193).
 *
 * Deliberately a local copy rather than an import. `COMPONENT_DEPENDENCIES` in
 * tests/standards.test.ts gives `evidence` exactly two dependencies — `custody` and `primitives` —
 * so reaching for the presentation component's copy would be an undeclared edge, and it would point
 * the wrong way besides: the log is the artefact an interface renders, not something that depends on
 * one. When a second component needs this vocabulary it belongs in `@custodian/primitives`, which
 * every component may already reach; it does not belong in an evidence → surfaces edge.
 *
 * `streaming` is in the vocabulary and is never projected. It describes how a response was
 * delivered, and the log records that a model was invoked and what it cost, not the transport. A
 * live run gets that state from the streaming channel; a finished run has no evidence of it, and
 * inventing one would put a claim in the evidence record that nothing in the record supports.
 */
export type AgentState =
  "queued" | "thinking" | "acting" | "awaiting-approval" | "streaming" | "recovering" | "failed";

/**
 * What the projection says about content it will not open.
 *
 * `SealedContent` is ciphertext under a subject key and a bucket key, and this carries neither the
 * ciphertext nor the wrapped keys — only the two identifiers naming which keys would open it, and
 * the length of the stored ciphertext. That length distinguishes a step that carried a payload from
 * one that carried nothing, which an investigator needs; it says nothing about what the payload
 * said. It is not named for the ciphertext on purpose, so that a test asserting the word
 * `ciphertext` never appears in a rendered timeline stays a test about leaked content.
 *
 * A caller that genuinely needs plaintext asks the key store for it, deliberately and on the record.
 * An inspector that unsealed content in order to draw a timeline would be a new location personal
 * data reaches, with its own retention story and its own erasure obligation, created by a read
 * model — which is exactly the kind of location the data map exists to prevent appearing by
 * accident.
 */
export type SealedContentRef = {
  readonly subject: SubjectId;
  readonly bucket: RetentionBucket;
  readonly sealedLength: number;
};

/**
 * One projected entry per logged entry, in sequence. The two content-bearing events carry a
 * `SealedContentRef` where the log carries `SealedContent`; every other event is metadata already
 * and passes through unchanged.
 *
 * `SealedContent` does not appear anywhere in this union, which is what makes the guarantee
 * structural rather than a habit: an execution event that gains a sealed field cannot be projected
 * until someone decides what its reference looks like, and the build stops until they do.
 */
export type StepDetail =
  | {
      readonly kind: "run-started";
      readonly principal: Principal;
      readonly tenant: TenantId;
      readonly region: Region;
      readonly legalBasisPolicy: string;
      readonly request: SealedContentRef;
    }
  | {
      readonly kind: "record-retrieved";
      readonly recordId: string;
      readonly classification: "public" | "internal" | "confidential" | "personal";
      readonly provenance: "tenant-authored" | "user-supplied" | "external-untrusted";
    }
  | {
      readonly kind: "model-invoked";
      readonly snapshot: ModelSnapshot;
      readonly promptVersion: PromptVersion;
      readonly routerDecision: ProviderId;
      readonly routerRationale: string;
    }
  | {
      readonly kind: "tool-called";
      readonly tool: ToolName;
      readonly arguments: SealedContentRef;
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
      readonly invocationSeq: number;
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly costMicros: number;
    }
  | {
      readonly kind: "run-finished";
      readonly outcome: "succeeded" | "failed" | "halted" | "refused";
    };

export type TimelineStep = {
  readonly seq: number;
  readonly at: string;
  readonly detail: StepDetail;
};

/** A run of consecutive entries the run spent in one state, closed by the entry that changed it. */
export type StateSpan = {
  readonly state: AgentState;
  readonly at: string;
  readonly fromSeq: number;
  readonly toSeq: number;
};

/**
 * Cost for one model invocation, settled by the `invocationSeq` its usage entries name. Multiple
 * settlements of one invocation sum, which is the arithmetic `spansFromRun` and `meterEventsFrom`
 * already apply, so an inspector and the meter cannot disagree about the same log.
 */
export type InvocationCost = {
  readonly invocationSeq: number;
  readonly snapshot: ModelSnapshot;
  readonly routerDecision: ProviderId;
  readonly settlements: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicros: number;
};

/**
 * `unattributedSeqs` is the reconciliation finding this projection exists to surface: a settlement
 * naming an invocation the run never made is real spend with nothing to charge it to, and the only
 * alternative to reporting it is attributing it to whichever invocation sits nearest — which is the
 * adjacency guess `invocationSeq` was added to the event to prevent.
 *
 * `totalMicros` counts every settlement, attributed or not, so it always equals the sum of
 * `perInvocation` plus `unattributedMicros`.
 */
export type RunCost = {
  readonly perInvocation: readonly InvocationCost[];
  readonly totalMicros: number;
  readonly unattributedMicros: number;
  readonly unattributedSeqs: readonly number[];
};

/** Whether the hash chain holds, and where it first diverges if it does not. */
export type ChainIntegrity =
  | { readonly kind: "verified" }
  | { readonly kind: "broken"; readonly failure: LogIntegrityFailure };

/**
 * `integrity` is a required field rather than something a caller may compute separately, because a
 * screen that renders the contents of an evidence record without saying whether the record is intact
 * is showing evidence it has not checked. A tampered log renders identically to an honest one.
 *
 * `outcome` reports `refused` as itself. A refusal is a residency boundary the fallback chain
 * declined to cross — the platform working, and the outcome most in need of evidence — so it is
 * never folded into `failed`, and it produces no `failed` state span.
 */
export type RunTimeline = {
  readonly runId: RunId | undefined;
  readonly integrity: ChainIntegrity;
  readonly subjects: readonly SubjectId[];
  readonly outcome: "succeeded" | "failed" | "halted" | "refused" | "in-flight";
  readonly states: readonly StateSpan[];
  readonly steps: readonly TimelineStep[];
  readonly cost: RunCost;
};
