import type { Namespace, Result, ToolName } from "@custodian/domain-primitives";

export type RetrievedRecord = {
  readonly recordId: string;
  readonly classification: "public" | "internal" | "confidential" | "personal";
  readonly provenance: "tenant-authored" | "user-supplied" | "external-untrusted";
  readonly text: string;
};

export type ToolObservation = {
  /**
   * Fallback context text for tools that retrieve nothing; a retrieval tool's context is rebuilt
   * by the runtime from railed records, so blocked text can never ride in through here.
   */
  readonly observation: string;
  readonly retrieved: readonly RetrievedRecord[];
};

export type ToolFailure =
  | { readonly kind: "invalid-arguments"; readonly reason: string }
  | { readonly kind: "execution-failed"; readonly reason: string };

/**
 * The namespace is handed to the tool, derived upstream from a verified claim — a tool never sees
 * a tenant identifier it could confuse, and cannot read outside its scope by construction.
 */
export interface Tool {
  readonly name: ToolName;
  execute(
    argumentsJson: string,
    namespace: Namespace,
  ): Promise<Result<ToolObservation, ToolFailure>>;
}
