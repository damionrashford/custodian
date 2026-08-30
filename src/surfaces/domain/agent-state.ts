import type { ToolName } from "@custodian/primitives";

/**
 * The seven states an agent run can be in, as a union where each carries what the interface is
 * obliged to show for it.
 *
 * The obligations are not advice. `Design_Interface_Standards.txt:174-193` names, per state, what
 * the user must see — and the reason they live in the type rather than in a checklist is that a
 * checklist is satisfied by remembering. A screen that renders `failed` without saying what was
 * already committed should not compile.
 *
 * Silence during a long-running task is the single most trust-destroying state, and this platform's
 * architecture guarantees long-running tasks: agents take minutes, not milliseconds.
 */
export type AgentState =
  | {
      readonly kind: "queued";
      /**
       * Position in the queue, or when it is expected to start. One of the two is required and
       * neither may be omitted: "never an indeterminate spinner alone" (:178).
       */
      readonly position: number | undefined;
      readonly expectedStartAt: string | undefined;
    }
  | {
      readonly kind: "thinking";
      /** The current objective, in plain language. Not the prompt, and not a token count. */
      readonly objective: string;
    }
  | {
      readonly kind: "acting";
      /** Which tool, on what, with what scope — this is the tool-use disclosure requirement. */
      readonly tool: ToolName;
      readonly subject: string;
      readonly scope: string;
    }
  | {
      readonly kind: "awaiting-approval";
      readonly onApproval: string;
      readonly onRejection: string;
      /** Undefined only where a lane genuinely has no deadline; the UI still says so. */
      readonly decideBy: string | undefined;
    }
  | {
      readonly kind: "streaming";
      readonly partial: string;
    }
  | {
      readonly kind: "recovering";
      readonly attempt: number;
      readonly ofAttempts: number;
      /** Whether the retry costs money again. Users ask this first and are rarely told. */
      readonly costReincurred: boolean;
    }
  | {
      readonly kind: "failed";
      readonly whatFailed: string;
      readonly atStep: string;
      /**
       * What already happened before the failure, and the field this whole union exists for.
       *
       * The platform performs real side effects — webhooks delivered, tokens billed, records
       * written — so a failure message that omits this forces the user to go and check elsewhere.
       * That is the moment trust breaks, not the failure (:193). An empty list is a real answer
       * and must be said out loud, which is why it is a list rather than an optional string.
       */
      readonly alreadyCommitted: readonly string[];
      /** Exactly one. A failure offering three choices is a failure the user has to triage. */
      readonly nextAction: string;
    };

export type AgentStateKind = AgentState["kind"];

/**
 * Every state, in the order a run passes through them. Exported so a UI can prove it renders all
 * seven rather than the happy four — the corpus requires failure and recovery to be *designed*,
 * and those are the two that get skipped.
 */
export const AGENT_STATES: readonly AgentStateKind[] = [
  "queued",
  "thinking",
  "acting",
  "awaiting-approval",
  "streaming",
  "recovering",
  "failed",
];

/**
 * Whether this state is waiting on a person rather than on the machine.
 *
 * Drives whether a surface may sit silent. A run that is thinking will move on its own; a run
 * awaiting approval will not, and showing the two the same way is how an approval queue stalls
 * without anyone noticing.
 */
export function needsAPerson(state: AgentState): boolean {
  return state.kind === "awaiting-approval" || state.kind === "failed";
}
