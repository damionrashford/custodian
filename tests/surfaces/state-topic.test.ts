import { expect, test } from "bun:test";
import { parseRunId, parseTenantId } from "@custodian/primitives";
import { topicForRun } from "@custodian/surfaces";
import { ACME, GLOBEX, namespaceOf, RUN_A, RUN_B } from "./viewer-fixtures";

test("the same run in two workspaces is two different channels", () => {
  // The whole isolation argument in one assertion: a viewer that guesses, leaks or is simply told
  // another tenant's run id still cannot name the channel that run is broadcast on.
  expect(topicForRun(namespaceOf(ACME), RUN_A)).not.toEqual(
    topicForRun(namespaceOf(GLOBEX), RUN_A),
  );
});

test("the channel name carries the workspace it belongs to", () => {
  const topic = topicForRun(namespaceOf(ACME), RUN_A);

  expect(topic).toContain(ACME);
  expect(topic).toContain(RUN_A);
});

test("two runs in one workspace are two different channels", () => {
  const namespace = namespaceOf(ACME);

  expect(topicForRun(namespace, RUN_A)).not.toEqual(topicForRun(namespace, RUN_B));
});

test("no pair of identifiers can collide on the channel separator", () => {
  // `topicForRun` joins on ":". That is only unambiguous while neither identifier can contain one,
  // which is a fact about two parsers in another component — invisible from the topic file, and
  // exactly the kind of cross-file invariant that stops being true without anybody noticing.
  for (const candidate of ["t_0:0000000000000000000000", "t_0000000000000000000000000:"]) {
    expect(parseTenantId(candidate).ok).toBe(false);
  }
  for (const candidate of ["r_0:0000000000000000000000", "r_run:0000000000000000000000"]) {
    expect(parseRunId(candidate).ok).toBe(false);
  }
});
