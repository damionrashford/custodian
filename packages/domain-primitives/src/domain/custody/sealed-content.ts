import type { RetentionBucket } from "./retention-bucket";
import type { SubjectId } from "../identity/subject-id";

/**
 * Ciphertext under two independent keys. Destroying either the subject key (Article 17 erasure) or
 * the bucket key (retention expiry) makes the plaintext unrecoverable, and neither operation
 * mutates these bytes — which is what lets the execution log's hash chain survive both.
 *
 * The two wrapped values are the single-use content key sealed under each of those key-encryption
 * keys. They are safe to persist beside the ciphertext precisely because they are useless without
 * the KEK, which lives in the KMS and never leaves it — that asymmetry is what a KMS is for.
 */
export type SealedContent = {
  readonly subject: SubjectId;
  readonly bucket: RetentionBucket;
  readonly iv: string;
  readonly ciphertext: string;
  readonly wrappedSubjectKey: string;
  readonly wrappedBucketKey: string;
};
