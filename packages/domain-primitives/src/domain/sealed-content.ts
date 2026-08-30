import type { RetentionBucket } from "./retention-bucket";
import type { SubjectId } from "./subject-id";

/**
 * Ciphertext under two independent keys. Destroying either the subject key (Article 17 erasure) or
 * the bucket key (retention expiry) makes the plaintext unrecoverable, and neither operation
 * mutates these bytes — which is what lets the execution log's hash chain survive both.
 */
export type SealedContent = {
  readonly subject: SubjectId;
  readonly bucket: RetentionBucket;
  readonly iv: string;
  readonly ciphertext: string;
};
