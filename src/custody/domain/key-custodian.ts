import {
  brand,
  type Brand,
  type ErasureProof,
  type KeyStoreFailure,
  type RetentionBucket,
  type Result,
  type SubjectId,
} from "@custodian/primitives";

/**
 * The name of a key-encryption key inside the KMS. Branded because it addresses a destructive
 * operation: a bare string here is one typo away from destroying a different subject's key, and the
 * two constructors below are the only ways to make one.
 */
export type CustodyKeyName = Brand<string, "CustodyKeyName">;

/**
 * Prefixed because subjects and buckets share one Transit mount. A bucket whose name happened to
 * equal a subject id would otherwise address that subject's KEK, and `expireBucket` — a scheduled,
 * unattended operation — would perform an Article 17 erasure nobody requested.
 */
export function subjectKeyName(subject: SubjectId): CustodyKeyName {
  return brand<CustodyKeyName>(`subject-${subject}`);
}

export function bucketKeyName(bucket: RetentionBucket): CustodyKeyName {
  return brand<CustodyKeyName>(`bucket-${bucket}`);
}

/**
 * A single-use content key: `plaintext` encrypts, `wrapped` is the same key sealed under the KEK and
 * is what gets persisted. The plaintext is never stored, so destroying the KEK makes every `wrapped`
 * value ever issued under it undecryptable — which is the whole mechanism
 * (data-protection-and-retention.txt:74).
 */
export type DataKey = {
  readonly plaintext: Uint8Array;
  readonly wrapped: string;
};

/**
 * The KMS, as this platform needs it. Deliberately narrower than any vendor's API: three operations,
 * none of which can read back a key that has been destroyed.
 */
export interface KeyCustodian {
  issueDataKey(name: CustodyKeyName): Promise<Result<DataKey, KeyStoreFailure>>;
  unwrapDataKey(
    name: CustodyKeyName,
    wrapped: string,
  ): Promise<Result<Uint8Array, KeyStoreFailure>>;
  destroyKey(name: CustodyKeyName): Promise<Result<ErasureProof, KeyStoreFailure>>;
}
