import type { ActionClass, Namespace, Result, ToolName } from "@custodian/primitives";

export type RetrievedRecord = {
  readonly recordId: string;
  readonly classification: "public" | "internal" | "confidential" | "personal";
  readonly provenance: "tenant-authored" | "user-supplied" | "external-untrusted";
  readonly text: string;
};

/**
 * What an acting tool hands back.
 *
 * Split in two because the halves have different trust. `summary` is written by this platform — the
 * exit code, the status, the fact that something ran — and is safe in the prompt verbatim. `output`
 * is whatever the action produced, which for a shell or a web fetch is attacker-influenced by
 * construction, so it is railed exactly like a retrieved chunk before any of it reaches the model.
 */
export type ActionReceipt = {
  readonly summary: string;
  readonly output: string;
  /**
   * What this call changed outside this process, in the platform's own words — one line per effect,
   * empty when it changed nothing.
   *
   * Separate from `summary` rather than derived from it, because a read and a write both produce a
   * summary and only one of them committed anything. The execution log's field group 4 asks for the
   * side effects of every tool call, and it is the field a failure message has to answer from: a
   * run that dies after a write and reports only that it failed sends the user somewhere else to
   * find out what already happened, which is where trust breaks rather than at the failure
   * (interface-standards.txt, the Failed state). A read logged as a committed effect would
   * make that answer wrong in the direction that matters, so this is a decision each tool takes.
   */
  readonly committed: readonly string[];
};

/**
 * A discriminated union rather than one bag carrying a records array and a loose text field.
 *
 * The previous shape did screen its free-form `observation`, so this is not closing an open hole.
 * What it fixes is that the two shapes were indistinguishable: an acting tool had to return an empty
 * `retrieved` array and smuggle its result through a field named for a retrieval fallback, and the
 * runtime had no way to tell "found nothing" from "ran something". Indirect injection arrives
 * through content the model reads (implementation-plan.txt:229), and keeping the
 * platform's own summary apart from the program's bytes is what lets only the second half be railed.
 */
export type ToolObservation =
  | { readonly kind: "retrieved"; readonly retrieved: readonly RetrievedRecord[] }
  | { readonly kind: "acted"; readonly receipt: ActionReceipt };

export type ToolFailure =
  | { readonly kind: "invalid-arguments"; readonly reason: string }
  | { readonly kind: "execution-failed"; readonly reason: string };

/**
 * The namespace is handed to the tool, derived upstream from a verified claim — a tool never sees
 * a tenant identifier it could confuse, and cannot read outside its scope by construction.
 */
export interface Tool {
  readonly name: ToolName;
  /**
   * What class of thing this tool does, which decides whether a human has to see it first.
   *
   * On the tool rather than on the call, because the model must not get to describe its own action
   * as low risk. Autonomy is a spectrum set per action class and per tenant, not a property of the
   * request (interface-standards.txt:200).
   */
  readonly actionClass: ActionClass;
  execute(
    argumentsJson: string,
    namespace: Namespace,
  ): Promise<Result<ToolObservation, ToolFailure>>;
}
