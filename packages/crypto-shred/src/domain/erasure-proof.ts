/**
 * The auditable artefact of a key destruction. In production this is the KMS destruction record —
 * timestamped, signed and independently verifiable (Data_Protection_and_Retention.txt:74).
 */
export type ErasureProof = {
  readonly target: string;
  readonly destroyedAt: string;
  readonly keyReference: string;
  readonly recordId: string;
};
