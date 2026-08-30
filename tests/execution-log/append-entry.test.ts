import { expect, test } from "bun:test";
import {
  appendEntry,
  GENESIS_HASH,
  parseRunId,
  type EntryHasher,
  type ExecutionEvent,
  type LoggedEntry,
} from "@custodian/execution-log";

const RUN = "r_01jd7k9h2m4n6p8r0s2t4v6x8z";

const stubHasher: EntryHasher = { hash: (input) => `h(${input.length.toString()})` };

function run() {
  const parsed = parseRunId(RUN);
  if (!parsed.ok) throw new Error("fixture: bad run id");
  return parsed.value;
}

const usage: ExecutionEvent = {
  kind: "usage-recorded",
  inputTokens: 120,
  outputTokens: 40,
  costMicros: 900,
};

const finished: ExecutionEvent = { kind: "run-finished", outcome: "succeeded" };

function appendOrThrow(log: readonly LoggedEntry[], event: ExecutionEvent): readonly LoggedEntry[] {
  const appended = appendEntry(log, event, {
    runId: run(),
    at: "2026-08-29T00:00:00.000Z",
    hasher: stubHasher,
  });
  if (!appended.ok) throw new Error(`append failed: ${appended.error.kind}`);
  return appended.value;
}

test("the first entry chains from the genesis hash at sequence 0", () => {
  const [first] = appendOrThrow([], usage);
  expect(first?.seq).toBe(0);
  expect(first?.previousHash).toBe(GENESIS_HASH);
});

test("each entry chains to its predecessor's hash", () => {
  const log = appendOrThrow(appendOrThrow([], usage), usage);
  expect(log[1]?.previousHash).toBe(log[0]?.hash);
  expect(log[1]?.seq).toBe(1);
});

test("nothing may be appended after the run has finished", () => {
  const closed = appendOrThrow([], finished);
  const appended = appendEntry(closed, usage, {
    runId: run(),
    at: "2026-08-29T00:00:01.000Z",
    hasher: stubHasher,
  });
  expect(appended).toEqual({
    ok: false,
    error: { kind: "run-already-finished", runId: run() },
  });
});
