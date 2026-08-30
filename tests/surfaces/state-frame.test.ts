import { describe, expect, test } from "bun:test";
import { parseToolName } from "@custodian/primitives";
import { AGENT_STATES, frameToWire, parseStateFrame, type AgentState } from "@custodian/surfaces";
import { RUN_A } from "./viewer-fixtures";

const AT = "2026-08-30T12:00:00.000Z";

function tool(name: string) {
  const parsed = parseToolName(name);
  if (!parsed.ok) {
    throw new Error(`fixture: tool name rejected: ${name}`);
  }
  return parsed.value;
}

/**
 * One example of every state, keyed by kind so the count can be checked against `AGENT_STATES`.
 * Failure and recovery are the two that get skipped when a transport is written against the happy
 * path, and they are the two the corpus is most insistent about.
 */
const EXAMPLES: Readonly<Record<AgentState["kind"], AgentState>> = {
  queued: { kind: "queued", position: 3, expectedStartAt: undefined },
  thinking: { kind: "thinking", objective: "Find the invoice for August." },
  acting: {
    kind: "acting",
    tool: tool("kb_search"),
    subject: "your documents",
    scope: "read only",
  },
  "awaiting-approval": {
    kind: "awaiting-approval",
    onApproval: "The refund is sent.",
    onRejection: "Nothing happens.",
    decideBy: AT,
  },
  streaming: { kind: "streaming", partial: "The invoice totals" },
  recovering: { kind: "recovering", attempt: 2, ofAttempts: 3, costReincurred: true },
  failed: {
    kind: "failed",
    whatFailed: "The refund could not be sent.",
    atStep: "Sending the refund",
    alreadyCommitted: ["The order was marked as returned."],
    nextAction: "Send the refund by hand.",
  },
};

function frameFor(state: AgentState) {
  return { runId: RUN_A, sequence: 7, at: AT, state };
}

describe("every state survives the wire", () => {
  test("there is an example of each of the seven", () => {
    // Without this, adding an eighth state and forgetting its example leaves the round trip below
    // passing on seven and silent on the one that was added.
    expect(Object.keys(EXAMPLES).sort()).toEqual([...AGENT_STATES].sort());
  });

  for (const kind of AGENT_STATES) {
    test(kind, () => {
      const original = frameFor(EXAMPLES[kind]);
      const parsed = parseStateFrame(frameToWire(original));

      expect(parsed.ok ? parsed.value : parsed.error).toEqual(original);
    });
  }
});

test("a queued state that also carries a start time survives", () => {
  const original = frameFor({ kind: "queued", position: undefined, expectedStartAt: AT });
  const parsed = parseStateFrame(frameToWire(original));

  // `JSON.stringify` drops a key whose value is `undefined`, so this only round-trips if absence is
  // read back as "not set" rather than rejected.
  expect(parsed.ok ? parsed.value : parsed.error).toEqual(original);
});

test("the frame says nothing about which workspace it belongs to", () => {
  const wire = frameToWire(frameFor(EXAMPLES.thinking));

  // The subscriber's namespace is a property of the connection. A copy of it in the payload would
  // be a second answer to "whose data is this", and a second answer is one some code path gets wrong.
  expect(wire).not.toContain("tenant");
  expect(wire).not.toContain("namespace");
});

function wireWith(overrides: Readonly<Record<string, unknown>>): string {
  return JSON.stringify({
    runId: RUN_A,
    sequence: 1,
    at: AT,
    state: EXAMPLES.thinking,
    ...overrides,
  });
}

const REJECTED: Readonly<Record<string, string>> = {
  "not json at all": "{",
  "a state kind nobody implements": wireWith({ state: { kind: "pondering", objective: "hmm" } }),
  "a run id from another grammar": wireWith({ runId: "../../etc/passwd" }),
  "a sequence that is not a whole number": wireWith({ sequence: 1.5 }),
  "a timestamp no clock produced": wireWith({ at: "whenever" }),
  "an objective that says nothing": wireWith({ state: { kind: "thinking", objective: "" } }),
  "a tool name that is not a tool name": wireWith({
    state: { kind: "acting", tool: "rm -rf /", subject: "x", scope: "y" },
  }),
  "a queue position smuggled in as a string": wireWith({
    state: { kind: "queued", position: "3" },
  }),
  "a queued state that can say neither where nor when": wireWith({ state: { kind: "queued" } }),
  "a failure that will not say what was already committed": wireWith({
    state: { kind: "failed", whatFailed: "x", atStep: "y", nextAction: "z" },
  }),
};

describe("what the parser refuses", () => {
  for (const [description, wire] of Object.entries(REJECTED)) {
    test(description, () => {
      expect(parseStateFrame(wire).ok).toBe(false);
    });
  }
});

test("a failure that committed nothing says so, and that is not the same as saying nothing", () => {
  const original = frameFor({
    kind: "failed",
    whatFailed: "The refund could not be sent.",
    atStep: "Sending the refund",
    alreadyCommitted: [],
    nextAction: "Send the refund by hand.",
  });
  const parsed = parseStateFrame(frameToWire(original));

  expect(parsed.ok ? parsed.value : parsed.error).toEqual(original);
});
