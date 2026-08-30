import { expect, test } from "bun:test";
import type { ContentHasher } from "@custodian/domain-primitives";
import {
  appendEntry,
  parseRunId,
  verifyRunLog,
  type ExecutionEvent,
  type LoggedEntry,
} from "@custodian/execution-log";

/**
 * FNV-1a, inline. A domain-level test imports no runtime primitive — that is the property the
 * layering rule exists to protect, so the test demonstrates it rather than relying on the linter.
 * A length counter would collide and hide a real hash-mismatch, so this is a real avalanche
 * function.
 */
const hasher: ContentHasher = {
  hash: (input) => {
    let accumulator = 0x811c9dc5;
    for (const character of input) {
      accumulator ^= character.codePointAt(0) ?? 0;
      accumulator = Math.imul(accumulator, 0x01000193) >>> 0;
    }
    return accumulator.toString(16).padStart(8, "0");
  },
};

function run() {
  const parsed = parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z");
  if (!parsed.ok) throw new Error("fixture: bad run id");
  return parsed.value;
}

function usage(inputTokens: number): ExecutionEvent {
  return { kind: "usage-recorded", inputTokens, outputTokens: 10, costMicros: 100 };
}

function threeEntryLog(): readonly LoggedEntry[] {
  let log: readonly LoggedEntry[] = [];
  for (const tokens of [10, 20, 30]) {
    const appended = appendEntry(log, usage(tokens), {
      runId: run(),
      at: "2026-08-29T00:00:00.000Z",
      hasher,
    });
    if (!appended.ok) throw new Error("fixture: append failed");
    log = appended.value;
  }
  return log;
}

test("an untouched chain verifies", () => {
  expect(verifyRunLog(threeEntryLog(), hasher).ok).toBe(true);
});

test("a mutated payload is detected at its own sequence number", () => {
  const log = threeEntryLog();
  const tampered = log.map((entry, index) =>
    index === 1 ? { ...entry, event: usage(99_999) } : entry,
  );
  expect(verifyRunLog(tampered, hasher)).toEqual({
    ok: false,
    error: { kind: "hash-mismatch", seq: 1 },
  });
});

test("a deleted entry is detected as a sequence gap", () => {
  const log = threeEntryLog();
  const gapped = [log[0], log[2]].filter((entry) => entry !== undefined);
  expect(verifyRunLog(gapped, hasher)).toEqual({
    ok: false,
    error: { kind: "sequence-gap", expected: 1, found: 2 },
  });
});

test("a rewritten predecessor breaks the chain link", () => {
  const log = threeEntryLog();
  const relinked = log.map((entry, index) =>
    index === 2 ? { ...entry, previousHash: "0".repeat(64) } : entry,
  );
  expect(verifyRunLog(relinked, hasher)).toEqual({
    ok: false,
    error: { kind: "chain-broken", seq: 2 },
  });
});
