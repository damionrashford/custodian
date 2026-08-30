import type { Namespace, Result, RunId } from "@custodian/domain-primitives";
import type { LoggedEntry } from "./logged-entry";

export type LogStoreFailure =
  /** The entries do not continue the stored tail. Written history cannot be replaced. */
  | {
      readonly kind: "chain-diverged";
      readonly expectedPrevious: string;
      readonly received: string;
    }
  | { readonly kind: "sequence-rewind"; readonly tail: number; readonly received: number }
  | { readonly kind: "unknown-run"; readonly runId: RunId }
  /** A stored row whose recomputed hash no longer matches — evidence edited or decayed at rest. */
  | { readonly kind: "corrupt-entry"; readonly runId: RunId; readonly seq: number };

/**
 * Append-only storage for the execution log. `verifyRunLog` detects tampering after the fact; this
 * port refuses it at write time, which is the other half of what
 * Compliance_and_Certification.txt:59 asks for — an audit log engineers can edit is not evidence,
 * and detection alone still allows the edit.
 *
 * Reads are scoped by namespace, derivable only from a verified tenant claim. A run identifier
 * names a run belonging to exactly one tenant, so an unscoped read would disclose across tenants
 * exactly the record that proves what was done with whose data.
 */
export interface ExecutionLogStore {
  append(
    namespace: Namespace,
    runId: RunId,
    entries: readonly LoggedEntry[],
  ): Promise<Result<void, LogStoreFailure>>;
  read(
    namespace: Namespace,
    runId: RunId,
  ): Promise<Result<readonly LoggedEntry[], LogStoreFailure>>;
}
