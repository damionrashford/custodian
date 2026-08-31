import type { ErasureProof, KeyStoreFailure, Result } from "@custodian/primitives";
import type { SubjectKeyStore } from "@custodian/custody";
import { expiresAtForDuration } from "@custodian/primitives";
import { bucketFor, isDueForDisposal } from "@custodian/primitives";

export type RedactionRequest = {
  readonly store: SubjectKeyStore;
  /** A timestamp inside the month whose content is being disposed of. */
  readonly writtenAt: string;
  readonly now: string;
};

export type RedactionRefusal = {
  readonly kind: "not-yet-due";
  readonly dueAt: string;
};

/**
 * Execution-log content is retained 30 days and then redacted, while metadata is retained
 * 24 months (data-protection-and-retention.txt:117-128). Redaction destroys the bucket key rather
 * than rewriting entries, because rewriting an entry would invalidate every hash after it and the
 * log would stop being evidence.
 *
 * The period comes from the schedule and the bucket is derived, not supplied. A caller handing in
 * an arbitrary bucket could destroy the Article 73 window on day one or leave it standing past day
 * 400, and neither is visible at the call site — the retention period is a legal position, not a
 * parameter (LD-9).
 */
export async function redactExpiredContent(
  request: RedactionRequest,
): Promise<Result<ErasureProof, KeyStoreFailure | RedactionRefusal>> {
  if (!isDueForDisposal("execution-log-content", request.writtenAt, request.now)) {
    return {
      ok: false,
      error: {
        kind: "not-yet-due",
        dueAt: expiresAtForDuration("execution-log-content", request.writtenAt),
      },
    };
  }
  return request.store.expireBucket(bucketFor("execution-log-content", request.writtenAt));
}
