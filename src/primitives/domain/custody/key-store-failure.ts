import type { RetentionBucket } from "./retention-bucket";
import type { SubjectId } from "../identity/subject-id";

/**
 * Why a seal, unseal or key destruction could not complete. A closed union rather than a bare
 * string, because the discriminant is what tells an erasure workflow whether to retry (an
 * infrastructure fault) or escalate (an identity problem) — collapsing them loses the only signal
 * that distinguishes the two.
 */
export type KeyStoreFailure =
  | { readonly kind: "subject-erased"; readonly subject: SubjectId }
  | { readonly kind: "bucket-expired"; readonly bucket: RetentionBucket }
  | { readonly kind: "ciphertext-corrupt" }
  /** The key-encryption key is gone from the KMS, so nothing wrapped under it can be opened. */
  | { readonly kind: "key-destroyed"; readonly name: string }
  /**
   * The KMS accepted a destroy request and the key is still readable afterwards. Distinct from a
   * refused destroy, and far more dangerous: the caller believes an erasure happened. It is a
   * failure rather than a proof precisely so nobody records evidence of a destruction this platform
   * never observed.
   */
  | { readonly kind: "destruction-unconfirmed"; readonly name: string }
  /** The KMS could not be reached or answered unintelligibly. Transient; the workflow retries. */
  | { readonly kind: "custodian-unreachable"; readonly detail: string };

/**
 * Whether a failure means the content is gone for good, or merely that the custodian could not be
 * reached.
 *
 * Only the first justifies discarding what could not be opened. The second is a fault that passes,
 * and a caller that deletes on it turns a brief outage into permanent data loss — which is exactly
 * what the discriminant above exists to prevent, and exactly what happens when every failure is
 * flattened into "erased".
 */
export function isTerminalFailure(failure: KeyStoreFailure): boolean {
  return (
    failure.kind === "subject-erased" ||
    failure.kind === "bucket-expired" ||
    failure.kind === "ciphertext-corrupt"
  );
}
