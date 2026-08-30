import type { SubjectId } from "@custodian/domain-primitives";

/**
 * Provenance is recorded at write time so retrieval can demote untrusted origins. Memory poisoning
 * creates persistent compromise by decoupling injection from damage across sessions — the injection
 * happens in one session, the damage in another, after the original context is discarded, so
 * single-session monitoring sees nothing suspicious at any point in time (OWASP ASI06,
 * Gap_Register_v2.txt:300).
 */
export type Provenance = "authenticated-user" | "tenant-authored" | "external-untrusted";

/** Factual memory is preferences and policies; experience memory is past actions and outcomes. */
export type MemoryCategory = "preference" | "policy" | "fact" | "experience";

export type MemoryEntry = {
  readonly category: MemoryCategory;
  readonly text: string;
  readonly provenance: Provenance;
  readonly subject: SubjectId | undefined;
  readonly writtenAt: string;
  /** Self-assessed, 0..1. One of the four recall terms. */
  readonly importance: number;
};

export type WritePolicy = {
  /**
   * A conservative, scope-limited write policy defining exactly what may be stored produced
   * markedly lower attack success in comparative testing, and is the simplest first line of defence
   * (Gap_Register_v2.txt:303). Everything not listed is session-only.
   */
  readonly persistableCategories: readonly MemoryCategory[];
};

export const DEFAULT_WRITE_POLICY: WritePolicy = {
  persistableCategories: ["preference", "policy"],
};

export type WriteVerdict =
  | { readonly kind: "persist" }
  | { readonly kind: "session-only"; readonly reason: "category-not-allowlisted" }
  | { readonly kind: "quarantine"; readonly reason: "untrusted-origin-write" }
  | { readonly kind: "contradiction"; readonly conflictsWith: string };

/**
 * Source isolation: external content is never treated as equivalent to authenticated user input in
 * a write decision (Data_Protection_and_Retention.txt:160-161). An untrusted-origin write is
 * quarantined rather than merely demoted, because a demoted-but-present poisoned memory is still
 * retrievable.
 */
export function mayPersist(
  entry: MemoryEntry,
  policy: WritePolicy,
  existing: readonly MemoryEntry[],
): WriteVerdict {
  if (entry.provenance === "external-untrusted") {
    return { kind: "quarantine", reason: "untrusted-origin-write" };
  }
  if (!policy.persistableCategories.includes(entry.category)) {
    return { kind: "session-only", reason: "category-not-allowlisted" };
  }

  // Contradiction checking on write, because decay alone does not catch a high-relevance fact that
  // has become false — the canonical case being a stored employer after a job change
  // (Agent_Architecture_Addendum.txt:153).
  const conflict = existing.find(
    (other) => other.category === entry.category && contradicts(other.text, entry.text),
  );
  return conflict === undefined
    ? { kind: "persist" }
    : { kind: "contradiction", conflictsWith: conflict.text };
}

function contradicts(existing: string, incoming: string): boolean {
  const subjectOf = (text: string) => text.split(" is ")[0]?.trim() ?? "";
  const left = subjectOf(existing);
  return left.length > 0 && left === subjectOf(incoming) && existing !== incoming;
}
