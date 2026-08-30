import { expect, test } from "bun:test";
import {
  AGENT_STATES,
  checkVocabulary,
  COPY,
  DISCLOSURE,
  ERRORS,
  needsAPerson,
} from "@custodian/surfaces";

test("every string in the catalogue passes the lexicon for its own surface", () => {
  // The catalogue is the thing the gate exists to protect, so it is checked against itself. A
  // banned-lexicon rule that never runs on the strings actually shipped is decoration.
  const offenders: string[] = [];
  for (const [key, entry] of Object.entries(COPY)) {
    for (const violation of checkVocabulary(entry.text, entry.surface)) {
      offenders.push(`${key}: "${violation.term}" -> ${violation.instead}`);
    }
  }
  expect(offenders).toEqual([]);
});

test("every error says what happened, what it cost, and one thing to do next", () => {
  // Reviewed as a set, per the corpus, which is how you notice three of them say "try again" and
  // only one means it.
  const incomplete: string[] = [];
  for (const [key, error] of Object.entries(ERRORS)) {
    if (error.cause.length === 0 || error.cost.length === 0 || error.nextAction.length === 0) {
      incomplete.push(key);
    }
  }
  expect(incomplete).toEqual([]);
});

test("no error copy leaks implementation or marketing language", () => {
  const offenders: string[] = [];
  for (const [key, error] of Object.entries(ERRORS)) {
    for (const line of [error.cause, error.cost, error.nextAction]) {
      for (const v of checkVocabulary(line, "end-user")) {
        offenders.push(`${key}: ${v.term}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

test("the disclosure names the agent at first contact and is versioned", () => {
  // Article 50: perceivable in the interaction surface itself, same weight as primary text. A
  // vague "assistant" reference does not discharge the duty, so the word is checked.
  expect(DISCLOSURE.primary.toLowerCase()).toContain("ai");
  expect(DISCLOSURE.version.length).toBeGreaterThan(0);
  expect(checkVocabulary(DISCLOSURE.primary, "end-user")).toEqual([]);
  expect(checkVocabulary(DISCLOSURE.secondary, "end-user")).toEqual([]);
});

test("all seven states have copy, including the two that get skipped", () => {
  // Failure and recovery must be designed, not left to a spinner. They are the two that get
  // dropped, so they are the two this asserts by name.
  for (const state of AGENT_STATES) {
    expect([state, COPY[`state.${state}`] !== undefined]).toEqual([state, true]);
  }
  expect(AGENT_STATES).toContain("failed");
  expect(AGENT_STATES).toContain("recovering");
});

test("the operator console keeps its working vocabulary, other surfaces do not", () => {
  // A blanket ban would break the console, where a platform engineer legitimately needs these
  // words. The rule is scoped by surface, not absolute.
  expect(checkVocabulary("namespace throttled", "operator-console")).toEqual([]);
  expect(checkVocabulary("namespace throttled", "approval").length).toBeGreaterThan(0);
});

test("marketing language is banned everywhere, including the console", () => {
  // A system that praises itself while acting autonomously reads as evasive.
  const consoleHit = checkVocabulary("Seamless, magical insights", "operator-console");
  expect(consoleHit.length).toBeGreaterThan(0);
  expect(consoleHit.every((v) => v.reason === "marketing-language")).toBe(true);
});

test("a stack trace is refused on every surface", () => {
  for (const surface of ["operator-console", "tenant-admin", "approval", "end-user"] as const) {
    const found = checkVocabulary("TypeError: cannot read x at Object.foo", surface);
    expect([surface, found.some((v) => v.reason === "never-surfaced")]).toEqual([surface, true]);
  }
});

test("a state waiting on a person is distinguishable from one that will move on its own", () => {
  // Showing them the same way is how an approval queue stalls without anyone noticing.
  expect(needsAPerson({ kind: "thinking", objective: "reading the invoice" })).toBe(false);
  expect(
    needsAPerson({
      kind: "awaiting-approval",
      onApproval: "writes one file",
      onRejection: "nothing happens",
      decideBy: "14:32",
    }),
  ).toBe(true);
});
