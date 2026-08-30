import type { ContentHasher } from "@custodian/primitives";
import { hashableEntry } from "../domain/append-entry";
import type { LoggedEntry } from "../domain/logged-entry";

/**
 * Rehydrates one stored row. The assertion below is sound because the hash makes it so: the stored
 * hash was computed over the canonical JSON of a genuine LoggedEntry at write time, and it is
 * recomputed from the parsed value before anything is returned — bytes that do not round-trip to a
 * real entry cannot match. A row edited into invalid JSON is the same answer as a hash mismatch:
 * undefined, never a throw and never data.
 *
 * This file exists so the eslint assertion exemption covers exactly one parser, not a whole
 * adapter (LD-11: the exemption list is pinned in tests/standards.test.ts, and growing it is a
 * decision made there).
 */
export function parseStoredEntry(json: string, hasher: ContentHasher): LoggedEntry | undefined {
  let parsed: LoggedEntry;
  try {
    parsed = JSON.parse(json) as LoggedEntry;
  } catch {
    return undefined;
  }
  return hasher.hash(hashableEntry(parsed)) === parsed.hash ? parsed : undefined;
}
