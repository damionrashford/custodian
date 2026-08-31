import { expect, test } from "bun:test";
import {
  briefFor,
  byUrgency,
  deadlineFor,
  generateReviewId,
  LANE_POLICIES,
  type PendingReview,
} from "@custodian/governance";
import type { ActionClass } from "@custodian/primitives";

const AT = "2026-08-30T12:00:00.000Z";

function pending(overrides: Partial<PendingReview>): PendingReview {
  return {
    review: generateReviewId(),
    action: "sensitive-data-access",
    lane: "standard",
    requestedAt: AT,
    deadlineAt: "2026-08-30T12:05:00.000Z",
    remainingMs: 60_000,
    presentedTo: undefined,
    ...overrides,
  };
}

function item(lane: PendingReview["lane"], remainingMs: number, requestedAt = AT): PendingReview {
  const action: ActionClass =
    lane === "fast"
      ? "low-risk-reversible"
      : lane === "standard"
        ? "sensitive-data-access"
        : "financial-or-irreversible";
  return pending({ lane, action, remainingMs, requestedAt });
}

test("the SLA runs from when the action was requested, not from when the queue noticed", () => {
  expect(deadlineFor({ action: "financial-or-irreversible", requestedAt: AT })).toBe(
    new Date(Date.parse(AT) + LANE_POLICIES.high.slaMs).toISOString(),
  );
  expect(deadlineFor({ action: "low-risk-reversible", requestedAt: AT })).toBe(
    new Date(Date.parse(AT) + LANE_POLICIES.fast.slaMs).toISOString(),
  );
});

test("an unreadable request timestamp yields no deadline rather than an invented one", () => {
  // A deadline computed from a clock nobody can read would still be enforced, and would be wrong.
  expect(deadlineFor({ action: "financial-or-irreversible", requestedAt: "yesterday" })).toBe(
    undefined,
  );
});

test("time remaining orders the queue, not age", () => {
  // Both arrived at the same instant and both deny on timeout, so only the clock separates them.
  const urgent = item("high", 2 * 60_000);
  const roomy = item("high", 20 * 60_000);
  expect([roomy, urgent].sort(byUrgency)).toEqual([urgent, roomy]);
});

test("the older item loses to the one closer to its deadline", () => {
  // Oldest-first is the order a queue falls into when nobody chooses one. The lanes do not share a
  // clock, so arrival time says nothing about which item is about to expire.
  const older = item("high", 20 * 60_000, "2026-08-30T11:00:00.000Z");
  const newer = item("standard", 60_000, "2026-08-30T11:59:00.000Z");
  expect([older, newer].sort(byUrgency)).toEqual([newer, older]);
});

test("a lane that auto-approves on timeout sorts last, however near its deadline is", () => {
  // The load-bearing correction to earliest-deadline-first. A fast-lane item's ten-second SLA puts
  // its deadline nearer than anything else can ever be, so under plain EDF the reviewer would spend
  // the whole hour on the thousand low-risk events while the irreversible ones expired behind them.
  // A fast-lane timeout auto-approves, so nothing is lost when its deadline passes unattended: it
  // is not a deadline, it is a scheduled auto-approval.
  const expiringFast = item("fast", 9_000);
  const stillRoomy = item("high", 25 * 60_000);
  expect([expiringFast, stillRoomy].sort(byUrgency)).toEqual([stillRoomy, expiringFast]);
});

test("two fast-lane items are still ordered against each other by time remaining", () => {
  const sooner = item("fast", 2_000);
  const later = item("fast", 8_000);
  expect([later, sooner].sort(byUrgency)).toEqual([sooner, later]);
});

test("the order is total, so two reads of an unchanged queue cannot disagree", () => {
  const left = item("high", 60_000);
  const right = item("high", 60_000);
  const forwards = [left, right].sort(byUrgency);
  const backwards = [right, left].sort(byUrgency);
  expect(forwards).toEqual(backwards);
});

test("the brief states what happens if the reviewer does nothing", () => {
  // The option every queue omits and the one a reviewer under load actually takes.
  const brief = briefFor(item("high", 60_000), AT);
  expect(brief.ifUnanswered).toEqual({ kind: "denied", reason: "timed-out-fail-safe" });
  expect(brief.reversible).toBe(false);

  const fast = briefFor(item("fast", 5_000), AT);
  expect(fast.ifUnanswered).toEqual({ kind: "proceed" });
  expect(fast.reversible).toBe(true);
});

test("the brief carries the instant an approval becomes acceptable", () => {
  const brief = briefFor(item("high", 60_000), AT);
  expect(brief.decidableFrom).toBe(
    new Date(Date.parse(AT) + LANE_POLICIES.high.minConsiderationMs).toISOString(),
  );
});

test("an irreversible action cannot be approved at rubber-stamping speed at all", () => {
  // assessOversight calls a queue clicked-through at a median under ten seconds. The high lane's
  // floor sits above that line, so the check stops being a report about last week.
  expect(LANE_POLICIES.high.minConsiderationMs).toBeGreaterThan(10_000);
  // And the fast lane's floor can never be what causes the timeout it is fencing.
  expect(LANE_POLICIES.fast.minConsiderationMs).toBeLessThan(LANE_POLICIES.fast.slaMs);
});
