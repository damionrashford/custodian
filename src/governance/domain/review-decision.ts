import type { PrincipalId } from "@custodian/primitives";
import type { ReviewId } from "./review-id";
import type { ReviewState } from "./pending-review";

/**
 * Why a reviewer's decision was not applied. Returned rather than thrown, and enumerated rather
 * than collapsed into one failure, because each calls for something different on the screen: a
 * stale link, a colleague who got there first, a deadline the platform has already acted on, an
 * item this person was never shown, one somebody else currently holds, and a click that arrived
 * too fast to have been a decision.
 *
 * `deadline-passed` is the one that has to exist. A decision that lands after the SLA expired has
 * already been overtaken — `resolveReview` denied or auto-approved the action at the deadline, and
 * the agent moved on. Applying it silently would write an approval into the record for an action
 * that was refused, which is worse than either outcome on its own: the evidence would say a human
 * allowed something the platform actually blocked.
 */
export type DecisionRefusal =
  | { readonly kind: "unknown-review"; readonly review: ReviewId }
  | { readonly kind: "already-decided"; readonly review: ReviewId; readonly state: ReviewState }
  | { readonly kind: "deadline-passed"; readonly review: ReviewId; readonly deadlineAt: string }
  | { readonly kind: "not-presented"; readonly review: ReviewId }
  /**
   * Somebody else is holding it. Distinct from `not-presented` because the answer differs: one is
   * "open it first", the other is "it is not yours to decide, and taking it would throw away the
   * review the holder is in the middle of".
   */
  | {
      readonly kind: "held-by-another";
      readonly review: ReviewId;
      readonly presentedTo: PrincipalId;
    }
  | { readonly kind: "too-soon"; readonly review: ReviewId; readonly decidableFrom: string };
