import type { ActionClass } from "@custodian/primitives";

/**
 * Risk-tiered decision lanes with SLAs. On timeout, fail safe to denied and capture partial context
 * for audit (gap-register.txt:317, reliability-and-operations.txt:193-208).
 *
 * The volume arithmetic is why lanes exist at all: fifty agents at twenty tool calls an hour produce
 * a thousand approval-eligible events an hour, and routing even 10% to human review consumes more
 * than three full-time equivalents doing nothing but rubber-stamping. An approval gate without a
 * staffing model is not oversight; it is a queue that will be cleared as fast as possible.
 */
export type Lane = "fast" | "standard" | "high";

export type LanePolicy = {
  readonly slaMs: number;
  /** Only the fast lane may auto-approve, and only within its limits. */
  readonly onTimeout: "auto-approve" | "deny";
  /**
   * The floor between being shown what an action does and being allowed to approve it. A rejection
   * has no floor: this exists to stop an approval nobody read, and a rejection is the direction the
   * whole component already fails in.
   *
   * The numbers are anchored to the rubber-stamp detector, which calls a queue clicked-through when
   * the median decision lands under ten seconds. The high lane's floor sits above that line, so an
   * irreversible action cannot be approved at rubber-stamping speed at all — the check stops being
   * a report about last week and becomes a refusal now. The standard lane's sits below it on
   * purpose: five seconds against a five-minute SLA costs a working reviewer nothing and still
   * means the screen was open. The fast lane's is a tenth of its SLA, so the floor can never be
   * what causes the timeout it is fencing.
   */
  readonly minConsiderationMs: number;
};

export const LANE_POLICIES: Readonly<Record<Lane, LanePolicy>> = {
  fast: { slaMs: 10_000, onTimeout: "auto-approve", minConsiderationMs: 1_000 },
  standard: { slaMs: 5 * 60_000, onTimeout: "deny", minConsiderationMs: 5_000 },
  high: { slaMs: 30 * 60_000, onTimeout: "deny", minConsiderationMs: 15_000 },
};

export function laneFor(action: ActionClass): Lane {
  switch (action) {
    case "low-risk-reversible":
      return "fast";
    case "sensitive-data-access":
      return "standard";
    case "financial-or-irreversible":
      return "high";
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}

export type ReviewRequest = {
  readonly action: ActionClass;
  readonly requestedAt: string;
};

export type ReviewOutcome =
  | { readonly kind: "approved"; readonly reviewer: string; readonly tookMs: number }
  | { readonly kind: "rejected"; readonly reviewer: string; readonly tookMs: number }
  | { readonly kind: "timed-out"; readonly lane: Lane; readonly waitedMs: number };

export type Resolution =
  | { readonly kind: "proceed" }
  | { readonly kind: "denied"; readonly reason: "rejected" | "timed-out-fail-safe" };

/**
 * A timeout on anything but the fast lane denies. Failing open on a financial action because nobody
 * answered is the failure this exists to prevent, and it is the failure a queue under load produces
 * by default.
 */
export function resolveReview(request: ReviewRequest, outcome: ReviewOutcome): Resolution {
  switch (outcome.kind) {
    case "approved":
      return { kind: "proceed" };
    case "rejected":
      return { kind: "denied", reason: "rejected" };
    case "timed-out": {
      const policy = LANE_POLICIES[laneFor(request.action)];
      return policy.onTimeout === "auto-approve"
        ? { kind: "proceed" }
        : { kind: "denied", reason: "timed-out-fail-safe" };
    }
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}

/**
 * Where a review actually happens. Implemented by whatever holds the human queue — a console, a
 * chat surface, a pager — and deliberately not by this component, which decides policy rather than
 * staffing it.
 */
export interface ApprovalGate {
  request(review: ReviewRequest): Promise<ReviewOutcome>;
}

/**
 * Whether an action of this class may proceed, given who is available to review it.
 *
 * An absent gate is treated as nobody answering, not as permission. That single choice is what
 * makes the whole thing fail safe: `resolveReview` already denies a timeout on every lane but the
 * fast one, so a deployment with no reviewer wired up can still run low-risk reversible work and
 * cannot run anything else. The alternative — treating "no gate configured" as "no approval needed"
 * — would make the strictest deployment the most permissive one.
 */
export async function seekApproval(
  action: ActionClass,
  gate: ApprovalGate | undefined,
  requestedAt: string,
): Promise<Resolution> {
  const review: ReviewRequest = { action, requestedAt };
  const lane = laneFor(action);
  if (gate === undefined) {
    return resolveReview(review, { kind: "timed-out", lane, waitedMs: 0 });
  }
  return resolveReview(review, await gate.request(review));
}
