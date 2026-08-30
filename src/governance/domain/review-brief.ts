import type { ActionClass } from "@custodian/primitives";
import { LANE_POLICIES, resolveReview, type Lane, type Resolution } from "./decision-lane";
import type { PendingReview } from "./pending-review";
import type { ReviewId } from "./review-id";

/**
 * What a reviewer is shown before they are allowed to decide, and the reason `open` exists as a
 * separate step from `approve`.
 *
 * The queue row deliberately cannot be decided from. Producing a brief is the moment the platform
 * records that this person was handed the consequence of this specific action, and an approval
 * without that record is refused. It does not make anyone read — no data model does — but it makes
 * the two things a careless approval needs impossible to have: a bulk endpoint, and deniability.
 * Every approval now names who was shown what, and how long they had it in front of them, which is
 * the input `assessOversight` was already written to consume and never had.
 */
export type ReviewBrief = {
  readonly review: ReviewId;
  readonly action: ActionClass;
  readonly lane: Lane;
  /**
   * Whether approving commits something the platform cannot take back. Derived rather than
   * inferred from the class name: the vocabulary rules put the consequence in front of the reader
   * instead of asking them to decode an internal category.
   */
  readonly reversible: boolean;
  /**
   * What happens if this reviewer does nothing. Always stated, because it is the option every
   * queue omits and the one a reviewer under load actually takes.
   */
  readonly ifUnanswered: Resolution;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  /** No approval is accepted before this instant — the lane's consideration floor. */
  readonly decidableFrom: string;
};

export function briefFor(pending: PendingReview, presentedAt: string): ReviewBrief {
  const policy = LANE_POLICIES[pending.lane];
  return {
    review: pending.review,
    action: pending.action,
    lane: pending.lane,
    reversible: pending.action === "low-risk-reversible",
    ifUnanswered: resolveReview(
      { action: pending.action, requestedAt: pending.requestedAt },
      { kind: "timed-out", lane: pending.lane, waitedMs: policy.slaMs },
    ),
    requestedAt: pending.requestedAt,
    deadlineAt: pending.deadlineAt,
    decidableFrom: new Date(Date.parse(presentedAt) + policy.minConsiderationMs).toISOString(),
  };
}
