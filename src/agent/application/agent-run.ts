import type {
  CompletionUsage,
  ContentHasher,
  Principal,
  Region,
  RunId,
  SubjectId,
} from "@custodian/primitives";
import type { HaltReason, LoopLimits, RunState } from "../domain/loop-controls";
import type { DeploymentLabel, Registry } from "@custodian/governance";
import type { ContextItem } from "@custodian/knowledge";
import type { SubjectKeyStore } from "@custodian/custody";
import type { ExecutionLogStore, LoggedEntry } from "@custodian/evidence";
import type { ModelProvider } from "@custodian/serving";
import type { Classifier } from "../domain/screen";
import type { IdempotencyStore } from "@custodian/serving";
import type { VerifiedTenantClaim } from "@custodian/knowledge";
import type { ProviderProfile } from "@custodian/serving";
import type { TaskClass } from "../domain/task-class";
import type { ToolCatalogue } from "../domain/tool-catalogue";
import type { ApprovalGate } from "@custodian/governance";
import type { Tool } from "../domain/tool";

/**
 * One run's contract and the words it may say out loud, in one place because the loop, the tool
 * step and the log writer all speak it — and because user-facing copy that lives beside the code
 * that emits it drifts into implementation language the moment a new branch needs a message.
 */
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
  /**
   * Who reviews an action before it happens. Optional in the type and never optional in effect:
   * leaving it out means nobody answers, which `seekApproval` resolves as a timeout — and a timeout
   * denies on every lane but the fast one. A deployment with no reviewer can still retrieve and can
   * do nothing irreversible.
   */
  readonly approvals?: ApprovalGate;
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
  readonly kind: "halted" | "refused" | "already-served" | "failed";
  /** Plain-language and surface-safe; the interface layer returns it verbatim. */
  readonly publicReason: string;
};

/** What the loop carries between turns. Mutable by design; one run owns exactly one of these. */
export type LoopContext = {
  log: readonly LoggedEntry[];
  state: RunState;
  readonly observations: ContextItem[];
  readonly corrections: string[];
  readonly seen: Set<string>;
};

const STOP_COPY =
  "The assistant stopped before finding an answer. Nothing was changed on your behalf.";

export const HALT_COPY: Readonly<Record<HaltReason, string>> = {
  "iteration-ceiling": STOP_COPY,
  stagnating: STOP_COPY,
  "unverified-action": STOP_COPY,
  "cost-ceiling": "This request reached its cost limit before finding an answer.",
};

export const REFUSED_COPY = "No provider in your region is available for this request.";
export const ALREADY_COPY = "This request was already submitted.";
export const FAILED_COPY = "The assistant could not complete this request.";

export const CORRECTION =
  'Reply with exactly one JSON object: {"action":"use-tool","tool":"<name>","arguments":{...}} or {"action":"answer","text":"..."}.';
