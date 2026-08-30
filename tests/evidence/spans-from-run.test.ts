import { expect, test } from "bun:test";
import {
  parseModelSnapshot,
  parsePrincipalId,
  parseProviderId,
  parsePromptVersion,
  parseRegion,
  parseRunId,
  parseSubjectId,
  parseTenantId,
  type Principal,
} from "@custodian/primitives";
import { appendEntry, Sha256ContentHasher, type LoggedEntry } from "@custodian/evidence";
import { bucketFor } from "@custodian/primitives";
import { GEN_AI_ATTRIBUTE, spansFromRun } from "@custodian/evidence";

const AT = "2026-08-29T00:00:00.000Z";
const hasher = new Sha256ContentHasher();
const SENTINEL = "SEALED-CIPHERTEXT-MUST-NOT-LEAK";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const tenant = must(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
const operator: Principal = {
  kind: "human",
  id: must(parsePrincipalId("p_operator"), "principal"),
  tenant,
};

function runFixture(): readonly LoggedEntry[] {
  const runId = must(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");
  const snapshot = must(parseModelSnapshot("frontier-1.5-20260801"), "model");
  const promptVersion = must(parsePromptVersion("pv_01jd7k9h2m4n6p8r0s2t4v6x8z"), "prompt version");
  const context = { runId, at: AT, hasher };
  const events = [
    {
      kind: "run-started",
      principal: operator,
      tenant,
      region: must(parseRegion("eu-west-1"), "region"),
      legalBasisPolicy: "tenant-contract",
      request: {
        subject: must(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject"),
        bucket: bucketFor("execution-log-content", AT),
        iv: "aXY=",
        ciphertext: SENTINEL,
        wrappedSubjectKey: "vault:v1:subject",
        wrappedBucketKey: "vault:v1:bucket",
      },
    },
    {
      kind: "model-invoked",
      snapshot,
      promptVersion,
      routerDecision: must(parseProviderId("eu-primary"), "provider"),
      routerRationale: "in-region, healthy",
    },
    {
      kind: "model-invoked",
      snapshot,
      promptVersion,
      routerDecision: must(parseProviderId("eu-secondary"), "provider"),
      routerRationale: "first choice returned a retryable failure",
    },
    {
      kind: "usage-recorded",
      invocationSeq: 2,
      inputTokens: 120,
      outputTokens: 480,
      costMicros: 2000,
    },
    { kind: "run-finished", outcome: "succeeded" },
  ] as const;

  let log: readonly LoggedEntry[] = [];
  for (const event of events) {
    log = must(appendEntry(log, event, context), "append");
  }
  return log;
}

test("usage attaches by recorded invocationSeq, never by adjacency", () => {
  // The same fixture with the settlement pointed at the FIRST invocation: adjacency would pin the
  // tokens on the last span regardless; the recorded association must win.
  const log = runFixture();
  const repointed = log.map((entry) =>
    entry.event.kind === "usage-recorded"
      ? { ...entry, event: { ...entry.event, invocationSeq: 1 } }
      : entry,
  );
  const spans = spansFromRun(repointed);
  expect(spans[0]?.attributes[GEN_AI_ATTRIBUTE.usageInputTokens]).toBe(120);
  expect(spans[1]?.attributes[GEN_AI_ATTRIBUTE.usageInputTokens]).toBeUndefined();
});

test("multiple settlements of one invocation sum, matching the meter", () => {
  const log = runFixture();
  const usageEntry = log.find((entry) => entry.event.kind === "usage-recorded");
  if (usageEntry === undefined || usageEntry.event.kind !== "usage-recorded") {
    throw new Error("fixture: no usage entry");
  }
  const doubled = [
    ...log.slice(0, -1),
    { ...usageEntry, event: { ...usageEntry.event, inputTokens: 30, outputTokens: 20 } },
  ];
  const spans = spansFromRun(doubled);
  expect(spans[1]?.attributes[GEN_AI_ATTRIBUTE.usageInputTokens]).toBe(150);
  expect(spans[1]?.attributes[GEN_AI_ATTRIBUTE.usageOutputTokens]).toBe(500);
});

test("one span per model invocation, usage attached to the attempt that served", () => {
  const spans = spansFromRun(runFixture());
  expect(spans).toHaveLength(2);
  expect(spans[0]?.name).toBe("chat frontier-1.5-20260801");
  expect(spans[0]?.attributes[GEN_AI_ATTRIBUTE.providerName]).toBe("eu-primary");
  expect(spans[0]?.attributes[GEN_AI_ATTRIBUTE.usageInputTokens]).toBeUndefined();
  expect(spans[1]?.attributes[GEN_AI_ATTRIBUTE.operationName]).toBe("chat");
  expect(spans[1]?.attributes[GEN_AI_ATTRIBUTE.providerName]).toBe("eu-secondary");
  expect(spans[1]?.attributes[GEN_AI_ATTRIBUTE.requestModel]).toBe("frontier-1.5-20260801");
  expect(spans[1]?.attributes[GEN_AI_ATTRIBUTE.usageInputTokens]).toBe(120);
  expect(spans[1]?.attributes[GEN_AI_ATTRIBUTE.usageOutputTokens]).toBe(480);
});

test("a run with no model invocation yields no spans", () => {
  expect(spansFromRun([])).toEqual([]);
});

test("no sealed content reaches a span, even serialized", () => {
  // Telemetry pipelines forward attributes wholesale; a ciphertext in a span is content leaving
  // the sealed store for a system with a different retention story. The attribute key union makes
  // this unrepresentable at compile time; this test is the runtime witness that survives a type
  // being widened.
  const serialized = JSON.stringify(spansFromRun(runFixture()));
  expect(serialized).not.toContain(SENTINEL);
  expect(serialized).not.toContain("ciphertext");
});
