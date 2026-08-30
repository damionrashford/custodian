import { expect, test } from "bun:test";
import {
  bucketFor,
  parseModelSnapshot,
  parsePrincipalId,
  parseProviderId,
  parsePromptVersion,
  parseRegion,
  parseRunId,
  parseSubjectId,
  parseTenantId,
  parseToolName,
  type Principal,
  type SealedContent,
} from "@custodian/primitives";
import {
  appendEntry,
  projectRunTimeline,
  Sha256ContentHasher,
  type ExecutionEvent,
  type LoggedEntry,
} from "@custodian/evidence";

const AT = "2026-08-29T00:00:00.000Z";
const hasher = new Sha256ContentHasher();
const SENTINEL = "SEALED-CIPHERTEXT-MUST-NOT-LEAK";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const runId = must(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");
const tenant = must(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
const subject = must(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject");
const snapshot = must(parseModelSnapshot("frontier-1.5-20260801"), "model");
const promptVersion = must(parsePromptVersion("pv_01jd7k9h2m4n6p8r0s2t4v6x8z"), "prompt version");
const operator: Principal = {
  kind: "human",
  id: must(parsePrincipalId("p_operator"), "principal"),
  tenant,
};

const sealed: SealedContent = {
  subject,
  bucket: bucketFor("execution-log-content", AT),
  iv: "aXY=",
  ciphertext: SENTINEL,
  wrappedSubjectKey: "vault:v1:subject",
  wrappedBucketKey: "vault:v1:bucket",
};

const started: ExecutionEvent = {
  kind: "run-started",
  principal: operator,
  tenant,
  region: must(parseRegion("eu-west-1"), "region"),
  legalBasisPolicy: "tenant-contract",
  request: sealed,
};

const invoked: ExecutionEvent = {
  kind: "model-invoked",
  snapshot,
  promptVersion,
  routerDecision: must(parseProviderId("eu-primary"), "provider"),
  routerRationale: "in-region, healthy",
};

function toolCall(status: "succeeded" | "failed" | "denied"): ExecutionEvent {
  return {
    kind: "tool-called",
    tool: must(parseToolName("issue_refund"), "tool"),
    arguments: sealed,
    status,
    sideEffectsCommitted: status === "succeeded" ? ["refund:inv_42"] : [],
  };
}

/** One minute per entry, so a span's `at` is distinguishable from its neighbours'. */
function build(events: readonly ExecutionEvent[]): readonly LoggedEntry[] {
  let log: readonly LoggedEntry[] = [];
  for (const [index, event] of events.entries()) {
    const at = new Date(Date.parse(AT) + index * 60_000).toISOString();
    log = must(appendEntry(log, event, { runId, at, hasher }), "append");
  }
  return log;
}

const FULL_RUN: readonly ExecutionEvent[] = [
  started,
  {
    kind: "record-retrieved",
    recordId: "kb_0007",
    classification: "personal",
    provenance: "external-untrusted",
  },
  {
    kind: "guardrail-evaluated",
    policy: "retrieval-rail",
    rule: "untrusted-source-may-not-instruct",
    outcome: "blocked",
  },
  invoked,
  {
    kind: "usage-recorded",
    invocationSeq: 3,
    inputTokens: 120,
    outputTokens: 480,
    costMicros: 2000,
  },
  {
    kind: "human-intervened",
    reviewer: must(parsePrincipalId("p_reviewer"), "reviewer"),
    decision: "approved",
    requestedAt: AT,
    decidedAt: "2026-08-29T00:04:30.000Z",
  },
  toolCall("succeeded"),
  { kind: "run-finished", outcome: "succeeded" },
];

test("the states are the sequence the run passed through, consecutive repeats collapsed", () => {
  const timeline = projectRunTimeline(build(FULL_RUN), hasher);

  // seq 2 is a guardrail evaluation and seq 4 a usage settlement: neither changes what the run is
  // doing, so the thinking span opened at the retrieval closes at the model invocation rather than
  // being split into two by the entries between them.
  expect(timeline.states).toEqual([
    { state: "queued", at: AT, fromSeq: 0, toSeq: 0 },
    { state: "thinking", at: "2026-08-29T00:01:00.000Z", fromSeq: 1, toSeq: 3 },
    { state: "awaiting-approval", at: "2026-08-29T00:05:00.000Z", fromSeq: 5, toSeq: 5 },
    { state: "acting", at: "2026-08-29T00:06:00.000Z", fromSeq: 6, toSeq: 6 },
  ]);
});

test("a failed tool call puts what follows in recovering, until one does not fail", () => {
  const timeline = projectRunTimeline(
    build([started, toolCall("failed"), invoked, toolCall("succeeded"), invoked]),
    hasher,
  );

  // The failing call itself was still the run acting; recovery is what happens next, and the
  // successful retry is the last step of it rather than the first step after it.
  expect(timeline.states.map((span) => span.state)).toEqual([
    "queued",
    "acting",
    "recovering",
    "thinking",
  ]);
  expect(timeline.states[2]).toEqual({
    state: "recovering",
    at: "2026-08-29T00:02:00.000Z",
    fromSeq: 2,
    toSeq: 3,
  });
});

test("a denied tool call is not a fault, so it does not arm recovery", () => {
  // The rail refused the call. The run is on its intended path and nothing is being recovered from;
  // treating a refusal as a fault would file a working control under malfunction.
  const timeline = projectRunTimeline(build([started, toolCall("denied"), invoked]), hasher);
  expect(timeline.states.map((span) => span.state)).toEqual(["queued", "acting", "thinking"]);
});

test("a refusal is reported as itself and never as a failure", () => {
  const refused = projectRunTimeline(
    build([started, { kind: "run-finished", outcome: "refused" }]),
    hasher,
  );
  const failed = projectRunTimeline(
    build([started, { kind: "run-finished", outcome: "failed" }]),
    hasher,
  );

  // A refusal is a residency boundary the fallback chain declined to cross — the platform working,
  // and the outcome most in need of evidence. Folding it into `failed` would file correct behaviour
  // under malfunction on the one screen an investigator reads.
  expect(refused.outcome).toBe("refused");
  expect(refused.states.map((span) => span.state)).toEqual(["queued"]);
  expect(failed.outcome).toBe("failed");
  expect(failed.states.map((span) => span.state)).toEqual(["queued", "failed"]);
});

test("whether the chain verifies is part of the timeline, not a separate question", () => {
  const log = build(FULL_RUN);
  expect(projectRunTimeline(log, hasher).integrity).toEqual({ kind: "verified" });

  const tampered = log.map((entry) =>
    entry.seq === 3 && entry.event.kind === "model-invoked"
      ? { ...entry, event: { ...entry.event, routerRationale: "in-region, healthy (edited)" } }
      : entry,
  );
  const timeline = projectRunTimeline(tampered, hasher);

  // A rewritten entry renders identically to an honest one. An inspector that showed the contents
  // without checking the chain would be showing evidence it had not checked, so the check is a
  // field of the projection rather than something a caller may forget to ask for.
  expect(timeline.integrity).toEqual({
    kind: "broken",
    failure: { kind: "hash-mismatch", seq: 3 },
  });
  expect(timeline.steps).toHaveLength(tampered.length);
});

test("no sealed content reaches the timeline, even serialized", () => {
  const serialized = JSON.stringify(projectRunTimeline(build(FULL_RUN), hasher));

  // An inspector that unsealed content in order to draw a timeline would be a new location personal
  // data reaches, with its own retention story and its own erasure obligation, created by a read
  // model. The type makes it unrepresentable; this is the runtime witness that survives the type
  // being widened.
  expect(serialized).not.toContain(SENTINEL);
  expect(serialized).not.toContain("ciphertext");
  expect(serialized).not.toContain("wrappedSubjectKey");
});

test("an erased subject's entries stay in the timeline as present-and-unreadable", () => {
  const log = build(FULL_RUN);
  const timeline = projectRunTimeline(log, hasher);

  // Destroying a subject key changes no byte of the log, so an erased run projects exactly like a
  // live one — which is the point. Omitting the sealed entries would cost the reader the ability to
  // see that the run happened at all, and erasure would have quietly rewritten the evidence record
  // it is supposed to leave standing.
  expect(timeline.steps).toHaveLength(log.length);
  expect(timeline.steps.map((step) => step.detail.kind)).toEqual(
    FULL_RUN.map((event) => event.kind),
  );
  expect(timeline.subjects).toEqual([subject]);

  const first = timeline.steps[0]?.detail;
  if (first?.kind !== "run-started") throw new Error("fixture: first step is not the run start");
  expect(first.request).toEqual({
    subject,
    bucket: bucketFor("execution-log-content", AT),
    sealedLength: SENTINEL.length,
  });
});

test("cost settles per invocation by the recorded invocationSeq, and repeats sum", () => {
  const timeline = projectRunTimeline(
    build([
      started,
      invoked,
      invoked,
      {
        kind: "usage-recorded",
        invocationSeq: 1,
        inputTokens: 10,
        outputTokens: 20,
        costMicros: 700,
      },
      {
        kind: "usage-recorded",
        invocationSeq: 1,
        inputTokens: 5,
        outputTokens: 5,
        costMicros: 300,
      },
    ]),
    hasher,
  );

  // Adjacency would charge both settlements to the invocation beside them; the recorded association
  // has to win, or the inspector and the meter disagree about the same log.
  expect(timeline.cost.perInvocation).toEqual([
    {
      invocationSeq: 1,
      snapshot,
      routerDecision: must(parseProviderId("eu-primary"), "provider"),
      settlements: 2,
      inputTokens: 15,
      outputTokens: 25,
      costMicros: 1000,
    },
    {
      invocationSeq: 2,
      snapshot,
      routerDecision: must(parseProviderId("eu-primary"), "provider"),
      settlements: 0,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
    },
  ]);
  expect(timeline.cost.totalMicros).toBe(1000);
  expect(timeline.cost.unattributedSeqs).toEqual([]);
});

test("a settlement naming no invocation is reported unattributed, not charged to the nearest one", () => {
  const timeline = projectRunTimeline(
    build([
      started,
      invoked,
      {
        kind: "usage-recorded",
        invocationSeq: 1,
        inputTokens: 10,
        outputTokens: 20,
        costMicros: 700,
      },
      {
        kind: "usage-recorded",
        invocationSeq: 99,
        inputTokens: 1,
        outputTokens: 1,
        costMicros: 300,
      },
    ]),
    hasher,
  );

  // Real spend with nothing to charge it to is the reconciliation finding worth surfacing. The only
  // alternative is guessing an owner, which is how a cost dashboard reconciles to zero variance
  // while being wrong about every line.
  expect(timeline.cost.unattributedSeqs).toEqual([3]);
  expect(timeline.cost.unattributedMicros).toBe(300);
  expect(timeline.cost.perInvocation[0]?.costMicros).toBe(700);

  const attributed = timeline.cost.perInvocation.reduce(
    (sum, invocation) => sum + invocation.costMicros,
    0,
  );
  expect(attributed + timeline.cost.unattributedMicros).toBe(timeline.cost.totalMicros);
});

test("an unfinished run says so rather than reporting an outcome it does not have", () => {
  const inFlight = projectRunTimeline(build([started, invoked]), hasher);
  expect(inFlight.outcome).toBe("in-flight");
  expect(inFlight.runId).toBe(runId);

  const empty = projectRunTimeline([], hasher);
  expect(empty).toEqual({
    runId: undefined,
    integrity: { kind: "verified" },
    subjects: [],
    outcome: "in-flight",
    states: [],
    steps: [],
    cost: { perInvocation: [], totalMicros: 0, unattributedMicros: 0, unattributedSeqs: [] },
  });
});
