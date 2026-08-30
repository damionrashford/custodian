import { expect, test } from "bun:test";
import { seekApproval, type ApprovalGate, type ReviewOutcome } from "@custodian/governance";

const AT = "2026-08-30T00:00:00.000Z";

function gateReturning(outcome: ReviewOutcome): ApprovalGate {
  return { request: () => Promise.resolve(outcome) };
}

test("low-risk reversible work proceeds with no reviewer at all", async () => {
  // The fast lane auto-approves on timeout, so a deployment with no approval queue can still
  // retrieve. Denying here would make the safest configuration unusable and get it turned off.
  const resolution = await seekApproval("low-risk-reversible", undefined, AT);
  expect(resolution).toEqual({ kind: "proceed" });
});

test("an irreversible action is denied when no reviewer is configured", async () => {
  // The load-bearing default. Treating "no gate wired up" as "no approval needed" would make the
  // strictest deployment the most permissive one.
  const resolution = await seekApproval("financial-or-irreversible", undefined, AT);
  expect(resolution).toEqual({ kind: "denied", reason: "timed-out-fail-safe" });
});

test("sensitive data access is denied when no reviewer is configured", async () => {
  const resolution = await seekApproval("sensitive-data-access", undefined, AT);
  expect(resolution).toEqual({ kind: "denied", reason: "timed-out-fail-safe" });
});

test("an approved action proceeds", async () => {
  const gate = gateReturning({ kind: "approved", reviewer: "p_operator", tookMs: 1_200 });
  expect(await seekApproval("financial-or-irreversible", gate, AT)).toEqual({ kind: "proceed" });
});

test("a rejected action is denied, and says it was rejected rather than timed out", async () => {
  // The two denials call for different next moves: rejected means stop, timed out means the queue
  // is backed up and later may work.
  const gate = gateReturning({ kind: "rejected", reviewer: "p_operator", tookMs: 900 });
  expect(await seekApproval("financial-or-irreversible", gate, AT)).toEqual({
    kind: "denied",
    reason: "rejected",
  });
});

test("a timeout on a high-stakes lane denies, and on the fast lane proceeds", async () => {
  // Failing open on an irreversible action because nobody answered is the failure this exists to
  // prevent, and it is what a queue under load produces by default.
  const timedOut = gateReturning({ kind: "timed-out", lane: "high", waitedMs: 30 * 60_000 });
  expect(await seekApproval("financial-or-irreversible", timedOut, AT)).toEqual({
    kind: "denied",
    reason: "timed-out-fail-safe",
  });

  const fastTimeout = gateReturning({ kind: "timed-out", lane: "fast", waitedMs: 10_000 });
  expect(await seekApproval("low-risk-reversible", fastTimeout, AT)).toEqual({ kind: "proceed" });
});
