import { expect, test } from "bun:test";
import { parseWorkflowId, type WorkflowPayload } from "@custodian/custody";
import { parseRetentionBucket, parseSubjectId } from "@custodian/primitives";
import {
  EnvelopeSubjectKeyStore,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
} from "@custodian/custody";

test("a well-formed workflow id parses and a malformed one is an error", () => {
  expect(parseWorkflowId("w_01jd7k9h2m4n6p8r0s2t4v6x8z").ok).toBe(true);
  expect(parseWorkflowId("workflow-1")).toEqual({
    ok: false,
    error: { kind: "invalid-workflow-id", received: "workflow-1" },
  });
});

test("a workflow payload carries sealed content, so the bought engine never holds plaintext", async () => {
  const subject = parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z");
  const bucket = parseRetentionBucket("content-2026-08");
  if (!subject.ok || !bucket.ok) throw new Error("fixture");

  const store = new EnvelopeSubjectKeyStore({
    custodian: new InMemoryKeyCustodian({ now: () => new Date("2026-08-29T00:00:00.000Z") }),
    registry: new SqliteDeletionRegistry(":memory:"),
  });
  const sealed = await store.seal({
    subject: subject.value,
    bucket: bucket.value,
    plaintext: "Jane Doe, jane@example.test",
  });
  if (!sealed.ok) throw new Error("seal failed");

  const payload: WorkflowPayload = {
    sealed: [sealed.value],
    metadata: { definition: "erasure", region: "eu-west-1" },
  };

  // Whatever the engine persists, no fragment of the plaintext is in it.
  const persisted = JSON.stringify(payload);
  expect(persisted).not.toContain("jane@example.test");
  expect(persisted).not.toContain("Jane Doe");
});
