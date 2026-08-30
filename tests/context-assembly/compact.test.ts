import { expect, test } from "bun:test";
import { compact, type ContextItem } from "@custodian/context-assembly";

const countTokens = (text: string) => Math.ceil(text.length / 4);

const SAFETY: ContextItem = {
  kind: "pinned-constraint",
  text: "Never issue a refund above 500 without human approval.",
};
const RESIDENCY: ContextItem = {
  kind: "pinned-constraint",
  text: "Never route this tenant outside eu-west-1.",
};

function message(index: number): ContextItem {
  return { kind: "message", text: `turn ${String(index)} `.repeat(20), at: "2026-08-29" };
}

const HISTORY: readonly ContextItem[] = [
  SAFETY,
  message(1),
  message(2),
  RESIDENCY,
  message(3),
  message(4),
  message(5),
];

test("every pinned constraint survives compaction to a fraction of the input", () => {
  const compacted = compact(HISTORY, 40, countTokens);
  expect(compacted.ok).toBe(true);
  if (!compacted.ok) return;

  const pins = compacted.value.filter((item) => item.kind === "pinned-constraint");
  expect(pins).toEqual([SAFETY, RESIDENCY]);
});

test("compaction actually reduces the context, so the test above is not trivially true", () => {
  const compacted = compact(HISTORY, 40, countTokens);
  if (!compacted.ok) throw new Error("expected compaction to succeed");
  expect(compacted.value.length).toBeLessThan(HISTORY.length);
});

test("messages are evicted oldest first", () => {
  const compacted = compact(HISTORY, 60, countTokens);
  if (!compacted.ok) throw new Error("expected compaction to succeed");

  const messages = compacted.value.filter((item) => item.kind === "message");
  expect(messages).not.toContain(message(1));
  expect(compacted.value.at(-1)).toEqual(message(5));
});

test("pins that alone exceed the budget FAIL rather than being silently dropped", () => {
  const compacted = compact([SAFETY, RESIDENCY, message(1)], 5, countTokens);
  expect(compacted).toEqual({
    ok: false,
    error: { kind: "pins-exceed-budget", pinnedTokens: 25, budgetTokens: 5 },
  });
});

test("a context that already fits is returned unchanged, preserving the cached prefix", () => {
  const compacted = compact(HISTORY, 10_000, countTokens);
  expect(compacted).toEqual({ ok: true, value: HISTORY });
});

test("pinned constraints keep their original order relative to each other", () => {
  const compacted = compact(HISTORY, 40, countTokens);
  if (!compacted.ok) throw new Error("expected compaction to succeed");

  const pinTexts = compacted.value
    .filter((item) => item.kind === "pinned-constraint")
    .map((item) => item.text);
  expect(pinTexts).toEqual([SAFETY.text, RESIDENCY.text]);
});
