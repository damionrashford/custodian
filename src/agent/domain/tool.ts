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
};

/**
 * A discriminated union rather than one bag carrying a records array and a loose text field.
 *
 * The previous shape did screen its free-form `observation`, so this is not closing an open hole.
 * What it fixes is that the two shapes were indistinguishable: an acting tool had to return an empty
 * `retrieved` array and smuggle its result through a field named for a retrieval fallback, and the
 * runtime had no way to tell "found nothing" from "ran something". Indirect injection arrives
 * through content the model reads (AI_Agent_Implementation_Plan_v2.txt:229), and keeping the
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
   * request (Design_Interface_Standards.txt:200).
   */
  readonly actionClass: ActionClass;
  execute(
    argumentsJson: string,
    namespace: Namespace,
  ): Promise<Result<ToolObservation, ToolFailure>>;
}
