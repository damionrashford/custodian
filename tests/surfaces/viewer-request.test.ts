import { expect, test } from "bun:test";
import { parseViewerRequest } from "@custodian/surfaces";
import { RUN_A } from "./viewer-fixtures";

test("a viewer may ask to watch a run", () => {
  const parsed = parseViewerRequest(JSON.stringify({ kind: "watch", runId: RUN_A }));

  expect(parsed.ok ? parsed.value : parsed.error).toEqual({ kind: "watch", runId: RUN_A });
});

test("a viewer may ask to stop watching one", () => {
  const parsed = parseViewerRequest(JSON.stringify({ kind: "unwatch", runId: RUN_A }));

  expect(parsed.ok ? parsed.value : parsed.error).toEqual({ kind: "unwatch", runId: RUN_A });
});

test("naming a channel directly is not something a viewer can do", () => {
  // The failure mode this rules out: a transport that reads a topic off the message subscribes the
  // sender to whatever they asked for. Here the vocabulary has no topic in it, so the message is
  // simply not a request — there is no field to sanitise and no check that can be forgotten.
  const parsed = parseViewerRequest(
    JSON.stringify({ kind: "subscribe", topic: "state:tenant:t_someone_else:run:r_x" }),
  );

  expect(parsed.ok).toBe(false);
});

test("a topic offered alongside a legitimate request is ignored, not honoured", () => {
  const parsed = parseViewerRequest(
    JSON.stringify({ kind: "watch", runId: RUN_A, topic: "state:tenant:t_someone_else:run:r_x" }),
  );

  expect(parsed.ok ? parsed.value : parsed.error).toEqual({ kind: "watch", runId: RUN_A });
});

test("a run id from another grammar is refused", () => {
  for (const runId of ["", "*", "r_x", "../r_01hb7k9h2m4n6p8r0s2t4v6x8z"]) {
    expect(parseViewerRequest(JSON.stringify({ kind: "watch", runId })).ok).toBe(false);
  }
});

test("anything that is not a request at all is refused", () => {
  for (const text of ["{", "[]", '"watch"', "null", JSON.stringify({ kind: "watch" })]) {
    expect(parseViewerRequest(text).ok).toBe(false);
  }
});
