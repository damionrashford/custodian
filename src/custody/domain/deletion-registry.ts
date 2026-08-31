import type { ErasureProof } from "@custodian/primitives";
import type { CustodyKeyName } from "./key-custodian";

/**
 * Step 8 of the erasure workflow — "emit proof to the deletion registry; the registry entry is the
 * auditable evidence" (data-protection-and-retention.txt:106-107).
 *
 * It is also what makes step 5 idempotent, which is a separate obligation: "a repeat request is a
 * no-op returning the original proof" (:95-96). The KMS cannot supply that, because after the key is
 * destroyed the KMS holds nothing to answer with — a second destroy request finds a 404. The
 * original proof exists only if this side kept it.
 */
export interface DeletionRegistry {
  record(name: CustodyKeyName, proof: ErasureProof): void;
  lookup(name: CustodyKeyName): ErasureProof | undefined;
  /**
   * Drops proofs past the execution-log metadata period, and returns how many went.
   *
   * Sealing made every other store erasable *on request*; it did nothing about disposal *on
   * schedule*, and those are separate obligations (LD-9). This one is sharper than most: the row
   * holds a subject identifier and records that person's erasure, so keeping it forever would mean
   * the one store nobody can ask us to clear is also the one that names them. It is retained as
   * evidence for as long as the evidence is owed — the AI Act and SOC 2 window the execution log's
   * metadata uses — and no longer.
   */
  disposeExpired(now: string): number;
}
