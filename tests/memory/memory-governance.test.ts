import { expect, test } from "bun:test";
import {
  DEFAULT_RECALL_WEIGHTS,
  DEFAULT_WRITE_POLICY,
  isStale,
  mayPersist,
  scoreRecall,
  type MemoryCandidate,
} from "@custodian/memory";

const NOW = "2026-08-29T00:00:00.000Z";

function entry(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    category: "preference",
    text: "prefers concise answers",
    provenance: "authenticated-user",
    subject: undefined,
    writtenAt: NOW,
    importance: 0.5,
    ...overrides,
  };
}

test("an allowlisted category from a trusted origin persists", () => {
  expect(mayPersist(entry(), DEFAULT_WRITE_POLICY, [])).toEqual({ kind: "persist" });
});

test("a category outside the allowlist is session-only, not persisted", () => {
  expect(mayPersist(entry({ category: "experience" }), DEFAULT_WRITE_POLICY, [])).toEqual({
    kind: "session-only",
    reason: "category-not-allowlisted",
  });
});

test("an untrusted-origin write is quarantined, not merely demoted", () => {
  expect(mayPersist(entry({ provenance: "external-untrusted" }), DEFAULT_WRITE_POLICY, [])).toEqual(
    { kind: "quarantine", reason: "untrusted-origin-write" },
  );
});

test("source isolation outranks the allowlist — untrusted content never persists", () => {
  const untrustedButAllowlisted = entry({ category: "policy", provenance: "external-untrusted" });
  expect(mayPersist(untrustedButAllowlisted, DEFAULT_WRITE_POLICY, []).kind).toBe("quarantine");
});

test("a contradicting write is flagged rather than silently layered on the old fact", () => {
  const existing = entry({ category: "policy", text: "refund window is 30 days" });
  const incoming = entry({ category: "policy", text: "refund window is 60 days" });
  expect(mayPersist(incoming, DEFAULT_WRITE_POLICY, [existing])).toEqual({
    kind: "contradiction",
    conflictsWith: "refund window is 30 days",
  });
});

test("provenance demotes at retrieval, not only at write", () => {
  const trusted = entry({ provenance: "authenticated-user" });
  const untrusted = entry({ provenance: "external-untrusted" });
  const score = (e: MemoryCandidate) =>
    scoreRecall({ entry: e, relevance: 0.9, now: NOW, weights: DEFAULT_RECALL_WEIGHTS });

  expect(score(trusted)).toBeGreaterThan(score(untrusted));
});

test("recall is not similarity alone — a stale entry loses to a fresh one at equal relevance", () => {
  const fresh = entry({ writtenAt: NOW });
  const old = entry({ writtenAt: "2026-02-01T00:00:00.000Z" });
  const score = (e: MemoryCandidate) =>
    scoreRecall({ entry: e, relevance: 0.9, now: NOW, weights: DEFAULT_RECALL_WEIGHTS });

  expect(score(fresh)).toBeGreaterThan(score(old));
});

test("importance separates two entries that are equally recent and relevant", () => {
  const score = (importance: number) =>
    scoreRecall({
      entry: entry({ importance }),
      relevance: 0.5,
      now: NOW,
      weights: DEFAULT_RECALL_WEIGHTS,
    });

  expect(score(0.9)).toBeGreaterThan(score(0.1));
});

test("a high-relevance fact expires on schedule rather than being left to decay", () => {
  const oldFact = entry({ category: "fact", writtenAt: "2026-01-01T00:00:00.000Z" });
  expect(isStale(oldFact, NOW)).toBe(true);
});

test("a preference of the same age is not yet stale — expiry is per category", () => {
  const oldPreference = entry({ category: "preference", writtenAt: "2026-01-01T00:00:00.000Z" });
  expect(isStale(oldPreference, NOW)).toBe(false);
});
