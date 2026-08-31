import { brand, type Brand, type ContentHasher, err, ok, type Result } from "@custodian/primitives";
import { GENESIS_HASH, hashableEntry } from "./append-entry";
import type { LoggedEntry } from "./logged-entry";

/** A log that cannot be constructed without passing verification. */
export type VerifiedRunLog = Brand<readonly LoggedEntry[], "VerifiedRunLog">;

export type LogIntegrityFailure =
  | { readonly kind: "sequence-gap"; readonly expected: number; readonly found: number }
  | { readonly kind: "chain-broken"; readonly seq: number }
  | { readonly kind: "hash-mismatch"; readonly seq: number };

/**
 * An audit log engineers can edit is not evidence (compliance-and-certification.txt:59). Each entry
 * commits to its predecessor's hash, so a mutated payload, a deleted entry and a rewritten link are
 * all detectable — and each reports the sequence number where the chain first diverges.
 */
export function verifyRunLog(
  log: readonly LoggedEntry[],
  hasher: ContentHasher,
): Result<VerifiedRunLog, LogIntegrityFailure> {
  let expectedPrevious = GENESIS_HASH;

  for (const [index, entry] of log.entries()) {
    if (entry.seq !== index) {
      return err({ kind: "sequence-gap", expected: index, found: entry.seq });
    }
    if (entry.previousHash !== expectedPrevious) {
      return err({ kind: "chain-broken", seq: entry.seq });
    }
    if (hasher.hash(hashableEntry(entry)) !== entry.hash) {
      return err({ kind: "hash-mismatch", seq: entry.seq });
    }
    expectedPrevious = entry.hash;
  }

  return ok(brand<VerifiedRunLog, readonly LoggedEntry[]>(log));
}
