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
  | { readonly kind: "ciphertext-corrupt" };
