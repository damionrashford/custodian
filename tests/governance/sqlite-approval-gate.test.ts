import { expect, test } from "bun:test";
import {
  LANE_POLICIES,
  SqliteApprovalGate,
  type PendingReview,
  type ReviewOutcome,
} from "@custodian/governance";
import { parsePrincipalId, type PrincipalId } from "@custodian/primitives";

const AT = "2026-08-30T12:00:00.000Z";

function principal(value: string): PrincipalId {
  const parsed = parsePrincipalId(value);
  if (!parsed.ok) {
    throw new Error("fixture did not parse");
  }
  return parsed.value;
}

const REVIEWER = principal("p_ops1");
const COLLEAGUE = principal("p_ops2");

/** A clock the test moves, so an SLA measured in minutes costs a millisecond to exercise. */
function clock(from: string): { now: () => number; advance: (ms: number) => void } {
  let at = Date.parse(from);
  return {
    now: () => at,
    advance: (ms: number) => {
      at += ms;
    },
  };
}

function temporaryPath(): string {
  return `${process.env["TMPDIR"] ?? "/tmp"}/custodian-approvals-${String(Bun.nanoseconds())}.sqlite`;
}

/**
 * `request` inserts the row before it awaits anything, so the queue can be read the moment the
 * promise exists. Every test below leans on that: the promise is the agent waiting, the queue read
 * is the console looking.
 */
function onlyPending(gate: SqliteApprovalGate): PendingReview {
  const [first] = gate.queue();
  if (first === undefined) {
    throw new Error("expected one pending review");
  }
  return first;
}

test("a request waits in the queue until somebody decides it", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting: Promise<ReviewOutcome> = gate.request({
    action: "sensitive-data-access",
    requestedAt: AT,
  });

  const pending = onlyPending(gate);
  expect(pending.lane).toBe("standard");
  expect(pending.remainingMs).toBe(LANE_POLICIES.standard.slaMs);

  expect(gate.open(pending.review, REVIEWER).ok).toBe(true);
  time.advance(LANE_POLICIES.standard.minConsiderationMs);
  const approved = gate.approve(pending.review, REVIEWER);
  expect(approved.ok).toBe(true);

  // The dwell time is measured from the handover, which is what makes it a review time rather than
  // a queue time — assessOversight was written to consume this and had nothing to read.
  expect(await waiting).toEqual({
    kind: "approved",
    reviewer: REVIEWER,
    tookMs: LANE_POLICIES.standard.minConsiderationMs,
  });
  expect(gate.queue()).toEqual([]);
  gate.close();
});

test("nobody can approve an item they were never shown", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "financial-or-irreversible", requestedAt: AT });
  const pending = onlyPending(gate);

  // The structural half of making carelessness harder: an approval endpoint that skips the handover
  // is the one a bulk "approve everything" button would be built on, so there is no such path.
  time.advance(LANE_POLICIES.high.minConsiderationMs);
  expect(gate.approve(pending.review, REVIEWER)).toEqual({
    ok: false,
    error: { kind: "not-presented", review: pending.review },
  });

  time.advance(LANE_POLICIES.high.slaMs);
  expect(await waiting).toMatchObject({ kind: "timed-out", lane: "high" });
  gate.close();
});

test("an item one reviewer opened cannot be approved by another", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "financial-or-irreversible", requestedAt: AT });
  const pending = onlyPending(gate);

  gate.open(pending.review, REVIEWER);
  time.advance(LANE_POLICIES.high.minConsiderationMs);
  expect(gate.approve(pending.review, COLLEAGUE)).toEqual({
    ok: false,
    error: { kind: "held-by-another", review: pending.review, presentedTo: REVIEWER },
  });

  time.advance(LANE_POLICIES.high.slaMs);
  expect(await waiting).toMatchObject({ kind: "timed-out" });
  gate.close();
});

test("a second reviewer cannot take an item out of the first one's hands", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "financial-or-irreversible", requestedAt: AT });
  const pending = onlyPending(gate);

  expect(gate.open(pending.review, REVIEWER).ok).toBe(true);
  // Otherwise the first reviewer reads the brief, decides, and is told they were never shown it —
  // a real review thrown away and the row handed to whoever clicked last.
  expect(gate.open(pending.review, COLLEAGUE)).toEqual({
    ok: false,
    error: { kind: "held-by-another", review: pending.review, presentedTo: REVIEWER },
  });

  time.advance(LANE_POLICIES.high.minConsiderationMs);
  expect(gate.approve(pending.review, REVIEWER).ok).toBe(true);
  expect(await waiting).toMatchObject({ kind: "approved", reviewer: REVIEWER });
  gate.close();
});

test("an approval faster than the lane's consideration floor is refused, not counted", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "financial-or-irreversible", requestedAt: AT });
  const pending = onlyPending(gate);

  const brief = gate.open(pending.review, REVIEWER);
  expect(brief.ok).toBe(true);
  time.advance(LANE_POLICIES.high.minConsiderationMs - 1);
  const tooSoon = gate.approve(pending.review, REVIEWER);
  expect(tooSoon).toEqual({
    ok: false,
    error: {
      kind: "too-soon",
      review: pending.review,
      decidableFrom: new Date(Date.parse(AT) + LANE_POLICIES.high.minConsiderationMs).toISOString(),
    },
  });

  time.advance(1);
  expect(gate.approve(pending.review, REVIEWER).ok).toBe(true);
  expect(await waiting).toMatchObject({ kind: "approved", reviewer: REVIEWER });
  gate.close();
});

test("a rejection has no floor — the fail-safe direction is not slowed down", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "financial-or-irreversible", requestedAt: AT });
  const pending = onlyPending(gate);

  gate.open(pending.review, REVIEWER);
  expect(gate.reject(pending.review, REVIEWER).ok).toBe(true);
  expect(await waiting).toEqual({ kind: "rejected", reviewer: REVIEWER, tookMs: 0 });
  gate.close();
});

test("an unanswered request times out on its lane's SLA", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "low-risk-reversible", requestedAt: AT });

  time.advance(LANE_POLICIES.fast.slaMs);
  // `timed-out` rather than a verdict: the fail-safe rule belongs to resolveReview, and deciding it
  // here as well would be a second place for it to drift.
  expect(await waiting).toEqual({
    kind: "timed-out",
    lane: "fast",
    waitedMs: LANE_POLICIES.fast.slaMs,
  });
  gate.close();
});

test("a decision arriving after the deadline does not apply", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "sensitive-data-access", requestedAt: AT });
  const pending = onlyPending(gate);
  gate.open(pending.review, REVIEWER);

  time.advance(LANE_POLICIES.standard.slaMs);
  expect(await waiting).toMatchObject({ kind: "timed-out", lane: "standard" });

  // The action was already denied by the fail-safe and the agent has moved on. Applying this would
  // write an approval into the record for something the platform refused, which is worse than
  // either outcome alone: the evidence would say a human allowed it.
  expect(gate.approve(pending.review, REVIEWER)).toEqual({
    ok: false,
    error: { kind: "already-decided", review: pending.review, state: "timed-out" },
  });
  gate.close();
});

test("a decision on a row nothing has swept yet is refused all the same", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "sensitive-data-access", requestedAt: AT });
  const pending = onlyPending(gate);
  gate.open(pending.review, REVIEWER);

  // Nothing has reconciled this row: the clock moves and the decision is attempted in the same
  // tick, before any sweep runs. The refusal has to come from the guard on the write itself, not
  // from housekeeping that may not have happened.
  time.advance(LANE_POLICIES.standard.slaMs + 1);
  expect(gate.approve(pending.review, REVIEWER)).toEqual({
    ok: false,
    error: { kind: "deadline-passed", review: pending.review, deadlineAt: pending.deadlineAt },
  });

  expect(await waiting).toMatchObject({ kind: "timed-out" });
  gate.close();
});

test("an approval on an expired item says it is too late, not too soon", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "sensitive-data-access", requestedAt: AT });
  const pending = onlyPending(gate);

  // Opened a millisecond before the deadline, so the consideration floor has not elapsed either.
  // Both refusals apply and only one is useful: "wait five seconds" is advice on an item that can
  // never be approved again, and it would send the reviewer back to a screen that is already dead.
  time.advance(LANE_POLICIES.standard.slaMs - 1);
  expect(gate.open(pending.review, REVIEWER).ok).toBe(true);
  time.advance(2);
  expect(gate.approve(pending.review, REVIEWER)).toEqual({
    ok: false,
    error: { kind: "deadline-passed", review: pending.review, deadlineAt: pending.deadlineAt },
  });

  expect(await waiting).toMatchObject({ kind: "timed-out" });
  gate.close();
});

test("an expired item is not shown to a reviewer at all", async () => {
  const time = clock(AT);
  const gate = new SqliteApprovalGate(":memory:", time.now);
  const waiting = gate.request({ action: "sensitive-data-access", requestedAt: AT });
  expect(gate.queue()).toHaveLength(1);

  time.advance(LANE_POLICIES.standard.slaMs);
  // Displaying an item whose decision cannot apply is an invitation to make one.
  expect(gate.queue()).toEqual([]);
  await waiting;
  gate.close();
});

test("a request whose timestamp cannot be read is never enqueued", async () => {
  const gate = new SqliteApprovalGate(":memory:", clock(AT).now);

  // No deadline can be enforced, so it is treated as unanswered rather than handed an invented one
  // — and an item nobody can time out must not sit in a human queue forever.
  expect(
    await gate.request({ action: "financial-or-irreversible", requestedAt: "yesterday" }),
  ).toEqual({ kind: "timed-out", lane: "high", waitedMs: 0 });
  expect(gate.queue()).toEqual([]);
  gate.close();
});

test("a crash cannot leave a decision applicable after its deadline", async () => {
  const path = temporaryPath();
  const time = clock(AT);
  const crashed = new SqliteApprovalGate(path, time.now);
  const waiting = crashed.request({ action: "sensitive-data-access", requestedAt: AT });
  const pending = onlyPending(crashed);
  crashed.open(pending.review, REVIEWER);

  // The process that was waiting is gone; nothing swept the row. A restart reconciles it, and the
  // guarded write would refuse it in any case.
  time.advance(LANE_POLICIES.standard.slaMs);
  const restarted = new SqliteApprovalGate(path, time.now);
  expect(restarted.queue()).toEqual([]);
  expect(restarted.approve(pending.review, REVIEWER)).toEqual({
    ok: false,
    error: { kind: "already-decided", review: pending.review, state: "timed-out" },
  });

  restarted.close();
  await waiting;
  crashed.close();
});

test("a decided review survives the process that decided it, and is disposed of on schedule", async () => {
  const path = temporaryPath();
  const time = clock(AT);
  const first = new SqliteApprovalGate(path, time.now);
  const waiting = first.request({ action: "sensitive-data-access", requestedAt: AT });
  const pending = onlyPending(first);
  first.open(pending.review, REVIEWER);
  first.reject(pending.review, REVIEWER);
  await waiting;
  first.close();

  const second = new SqliteApprovalGate(path, time.now);
  // Who allowed what is a human-intervention record, so it is kept on the execution-log metadata
  // clock rather than cleared on request — and it does go, rather than accumulating forever.
  expect(second.disposeExpired()).toBe(0);
  time.advance(25 * 30 * 24 * 60 * 60 * 1_000);
  expect(second.disposeExpired()).toBe(1);
  expect(second.approve(pending.review, REVIEWER)).toEqual({
    ok: false,
    error: { kind: "unknown-review", review: pending.review },
  });
  second.close();
});
