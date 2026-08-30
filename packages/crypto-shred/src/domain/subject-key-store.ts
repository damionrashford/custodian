import type {
  ErasureProof,
  KeyStoreFailure,
  RetentionBucket,
  Result,
  SealedContent,
  SubjectId,
} from "@custodian/domain-primitives";

export type SealRequest = {
  readonly subject: SubjectId;
  readonly bucket: RetentionBucket;
  readonly plaintext: string;
};

/**
 * Two obligations pull in opposite directions: Article 17 requires per-subject irreversible erasure
 * on demand, while the retention schedule requires all execution-log content to disappear at 30
 * days regardless of any request. Sealing under a single key would force one of them to be a
 * rewrite, which breaks the log's hash chain. So content is sealed under two independent keys and
 * destroying either makes the plaintext unrecoverable without touching a byte of ciphertext.
 */
export interface SubjectKeyStore {
  seal(request: SealRequest): Promise<Result<SealedContent, KeyStoreFailure>>;
  unseal(sealed: SealedContent): Promise<Result<string, KeyStoreFailure>>;
  destroySubjectKey(subject: SubjectId): Promise<Result<ErasureProof, KeyStoreFailure>>;
  expireBucket(bucket: RetentionBucket): Promise<Result<ErasureProof, KeyStoreFailure>>;
}
