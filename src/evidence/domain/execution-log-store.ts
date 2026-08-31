import type { Namespace, Result, RunId } from "@custodian/primitives";
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
  /** A stored row whose verification no longer holds — evidence edited or decayed at rest. */
  | { readonly kind: "corrupt-entry"; readonly runId: RunId; readonly seq: number }
  /**
   * The run was disposed of at retention expiry. Refused rather than re-created: a durable
   * replay that re-appends a disposed run would resurrect metadata past its lawful lifetime,
   * and the next sweep would not reap it for another full period.
   */
  | { readonly kind: "run-disposed"; readonly runId: RunId };

/**
 * Append-only storage for the execution log. `verifyRunLog` detects tampering after the fact; this
 * port refuses it at write time, which is the other half of what
 * compliance-and-certification.txt:59 asks for — an audit log engineers can edit is not evidence,
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
  /**
   * Dispose of whole runs whose metadata retention (`execution-log-metadata`, 24 months per the
   * schedule) has elapsed, and remember them so a replay cannot re-append what the schedule
   * removed. On the port, not one adapter: the retention obligation binds the store concept, and
   * an adapter without disposal is a deployment that silently retains evidence forever. Whole
   * runs, never single entries — deleting one entry breaks the hash chain of everything after it,
   * turning lawful disposal into apparent tampering. Returns the number of runs disposed of.
   */
  disposeExpiredRuns(now: string): Promise<number>;
}
