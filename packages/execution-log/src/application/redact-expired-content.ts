import type {
  ErasureProof,
  KeyStoreFailure,
  RetentionBucket,
  Result,
} from "@custodian/domain-primitives";
import type { SubjectKeyStore } from "@custodian/crypto-shred";

export type RedactionRequest = {
  readonly store: SubjectKeyStore;
  readonly bucket: RetentionBucket;
};

/**
 * Execution-log content is retained 30 days and then redacted, while metadata is retained
 * 24 months (Data_Protection_and_Retention.txt:117-128). Redaction destroys the bucket key rather
 * than rewriting entries, because rewriting an entry would invalidate every hash after it and the
 * log would stop being evidence.
 */
export function redactExpiredContent(
  request: RedactionRequest,
): Promise<Result<ErasureProof, KeyStoreFailure>> {
  return request.store.expireBucket(request.bucket);
}
