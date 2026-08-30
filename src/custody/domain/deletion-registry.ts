import type { ErasureProof } from "@custodian/primitives";
import type { CustodyKeyName } from "./key-custodian";

/**
 * Step 8 of the erasure workflow — "emit proof to the deletion registry; the registry entry is the
 * auditable evidence" (Data_Protection_and_Retention.txt:106-107).
 *
 * It is also what makes step 5 idempotent, which is a separate obligation: "a repeat request is a
 * no-op returning the original proof" (:95-96). The KMS cannot supply that, because after the key is
 * destroyed the KMS holds nothing to answer with — a second destroy request finds a 404. The
 * original proof exists only if this side kept it.
 */
export interface DeletionRegistry {
  record(name: CustodyKeyName, proof: ErasureProof): void;
  lookup(name: CustodyKeyName): ErasureProof | undefined;
}
