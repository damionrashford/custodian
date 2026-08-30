import type { ActionClass, PrincipalId } from "@custodian/primitives";
import { LANE_POLICIES, laneFor, type Lane, type ReviewRequest } from "./decision-lane";
import type { ReviewId } from "./review-id";

/**
 * A review is pending until exactly one of four things has happened to it, and three of them are
 * terminal. Modelled as a union member on the row rather than a pair of nullable timestamps,
 * because "decided and still pending" and "timed out and approved" are the states a queue silently
 * ends up in when the shape allows them.
 */
export type ReviewState = "pending" | "approved" | "rejected" | "timed-out";

/**
 * One row of the queue as a reviewer sees it. It carries no run identifier, no arguments and no
 * model content: the queue is a worklist, and everything a person needs in order to decide is
 * handed over one item at a time by `briefFor`, which records that the handover happened.
 */
export type PendingReview = {
  readonly review: ReviewId;
  readonly action: ActionClass;
  readonly lane: Lane;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  /** Against the caller's clock. Negative is impossible in a queue read — an expired item is gone. */
  readonly remainingMs: number;
  /** Who this item was last handed to, so two reviewers do not work the same row. */
  readonly presentedTo: PrincipalId | undefined;
};

/**
 * The SLA runs from when the action was requested, not from when the queue happened to record it.
 * Anything else lets a slow enqueue buy the reviewer time the requester never had.
 *
 * `undefined` when the timestamp does not parse. The caller fails safe on that rather than
 * inventing a deadline, because a deadline computed from a clock nobody can read is worse than no
 * review at all: it would be enforced, and it would be wrong.
 */
export function deadlineFor(request: ReviewRequest): string | undefined {
  const requestedAt = Date.parse(request.requestedAt);
  if (Number.isNaN(requestedAt)) {
    return undefined;
  }
  return new Date(requestedAt + LANE_POLICIES[laneFor(request.action)].slaMs).toISOString();
}

/**
 * Queue order, and it is deliberately not oldest-first.
 *
 * Oldest-first is the order a queue falls into when nobody chooses one, and it is wrong here
 * because the lanes do not share a clock. A high-lane item has thirty minutes and a fast-lane item
 * has ten seconds, so arrival time says nothing about which one is about to expire. The corpus
 * arithmetic is the reason it matters: fifty agents at twenty tool calls an hour produce a thousand
 * approval-eligible events an hour, and a queue long enough that the reviewer never reaches the
 * bottom of it is a queue whose *order* decides what actually gets reviewed. Everything below the
 * fold is decided by the timeout instead.
 *
 * So the order is earliest-deadline-first, on time remaining rather than on age — a high-lane item
 * with two minutes left outranks one with twenty, whichever arrived first.
 *
 * With one correction, which is the part worth arguing about. Under plain earliest-deadline-first a
 * fast-lane item always wins, because its ten-second SLA puts its deadline nearer than anything
 * else can ever be, and the reviewer would spend the entire hour on the thousand low-risk items
 * while the irreversible ones expire behind them. That inversion is not a scheduling detail, it is
 * the rubber-stamping failure arriving by the front door.
 *
 * The asymmetry that resolves it is already in `LANE_POLICIES`: a fast-lane timeout auto-approves,
 * so nothing is lost when its deadline passes unattended — the action proceeds exactly as it would
 * have with a reviewer nodding at it. A standard- or high-lane timeout *denies*, so a missed
 * deadline destroys real work and costs a human the re-do. A deadline whose expiry is harmless is
 * not a deadline; it is a scheduled auto-approval. Those sort last, and the practical consequence
 * is intended: a reviewer working this queue top-down will rarely see a fast-lane item at all,
 * which is how a thousand-an-hour firehose stays compatible with a human who reads things.
 *
 * Ties fall back to age and then to identity, so the order is total and two reads of an unchanged
 * queue cannot disagree.
 */
export function byUrgency(left: PendingReview, right: PendingReview): number {
  const consequence = timeoutCost(left.lane) - timeoutCost(right.lane);
  if (consequence !== 0) {
    return consequence;
  }
  if (left.remainingMs !== right.remainingMs) {
    return left.remainingMs - right.remainingMs;
  }
  if (left.requestedAt !== right.requestedAt) {
    return left.requestedAt < right.requestedAt ? -1 : 1;
  }
  return left.review < right.review ? -1 : 1;
}

function timeoutCost(lane: Lane): number {
  return LANE_POLICIES[lane].onTimeout === "deny" ? 0 : 1;
}
