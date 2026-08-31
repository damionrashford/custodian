import type { SealedContent, SubjectId } from "@custodian/primitives";

/**
 * Provenance is recorded at write time so retrieval can demote untrusted origins. Memory poisoning
 * creates persistent compromise by decoupling injection from damage across sessions — the injection
 * happens in one session, the damage in another, after the original context is discarded, so
 * single-session monitoring sees nothing suspicious at any point in time (OWASP ASI06,
 * gap-register.txt:300).
 */
export type Provenance = "authenticated-user" | "tenant-authored" | "external-untrusted";

/** Factual memory is preferences and policies; experience memory is past actions and outcomes. */
export type MemoryCategory = "preference" | "policy" | "fact" | "experience";

type MemoryMetadata = {
  readonly category: MemoryCategory;
  readonly provenance: Provenance;
  readonly subject: SubjectId | undefined;
  readonly writtenAt: string;
  /** Self-assessed, 0..1. One of the four recall terms. */
  readonly importance: number;
};

/**
 * A proposed memory, in the clear and never persisted. The write decision — allowlist, source
 * isolation, contradiction checking — needs to read the text, so it runs on this before anything
 * reaches storage.
 */
export type MemoryCandidate = MemoryMetadata & {
  readonly text: string;
};

/**
 * A persisted memory. The text is SealedContent because `agent-memory` is in the erasure data map
 * and the spec promises "key destruction + provenance-indexed purge" for it
 * (data-protection-and-retention.txt:55-57) — a plaintext entry would make `runErasure` report that
 * location invalidated while nothing was actually shredded, which is a false erasure claim on the
 * platform's own evidentiary artefact.
 *
 * Recall scoring and staleness read metadata only, so neither needs the key.
 */
export type MemoryEntry = MemoryMetadata & {
  readonly text: SealedContent;
};

export type WritePolicy = {
  /**
   * A conservative, scope-limited write policy defining exactly what may be stored produced
   * markedly lower attack success in comparative testing, and is the simplest first line of defence
   * (gap-register.txt:303). Everything not listed is session-only.
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
 * a write decision (data-protection-and-retention.txt:160-161). An untrusted-origin write is
 * quarantined rather than merely demoted, because a demoted-but-present poisoned memory is still
 * retrievable.
 */
export function mayPersist(
  candidate: MemoryCandidate,
  policy: WritePolicy,
  existing: readonly MemoryCandidate[],
): WriteVerdict {
  if (candidate.provenance === "external-untrusted") {
    return { kind: "quarantine", reason: "untrusted-origin-write" };
  }
  if (!policy.persistableCategories.includes(candidate.category)) {
    return { kind: "session-only", reason: "category-not-allowlisted" };
  }

  // Contradiction checking on write, because decay alone does not catch a high-relevance fact that
  // has become false — the canonical case being a stored employer after a job change
  // (architecture-addendum.txt:153).
  const conflict = existing.find(
    (other) => other.category === candidate.category && contradicts(other.text, candidate.text),
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
