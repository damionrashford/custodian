/**
 * The auditable artefact of a key destruction. In production this is the KMS destruction record —
 * "timestamped, signed and independently verifiable" (data-protection-and-retention.txt:74).
 */
export type ErasureProof = {
  readonly target: string;
  readonly destroyedAt: string;
  readonly keyReference: string;
  readonly recordId: string;
  /**
   * Who vouches for this record. `external` means a custodian outside the erasing party issued it;
   * `self` means the party that destroyed the key also wrote the evidence that it did.
   *
   * The corpus requires the artefact be independently verifiable but never argues that the erasing
   * party must be unable to forge it — that inference is ours, and it is why this is a field rather
   * than an assumption. Without it the two kinds are indistinguishable at the type level, and the
   * release gate cannot tell a proof it should accept from one it should not.
   */
  readonly attestation: "external" | "self";
};
