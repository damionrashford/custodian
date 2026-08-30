import type { ReviewOutcome } from "./decision-lane";

/**
 * A reviewer approving 99% of decisions at under ten seconds average review time is clicking, not
 * reviewing. This belongs on the same dashboard as the SLOs, because degraded oversight is a
 * reliability failure (Reliability_and_Operations.txt:211).
 *
 * Measure the outcome, not the affordance: reviewers given clear explanations of an AI's reasoning
 * deferred MORE heavily to it, so better explainability can substitute for oversight rather than
 * support it (Gap_Register_v2.txt:314). Explanation quality is not evidence that oversight works.
 */
const RUBBER_STAMP_APPROVAL_RATE = 0.99;
const RUBBER_STAMP_MEDIAN_MS = 10_000;

export type OversightHealth =
  | { readonly kind: "healthy"; readonly approvalRate: number; readonly medianMs: number }
  | {
      readonly kind: "rubber-stamping";
      readonly approvalRate: number;
      readonly medianMs: number;
    }
  | { readonly kind: "insufficient-sample"; readonly reviewed: number };

const MIN_SAMPLE = 20;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (upper === undefined) return 0;
  return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper;
}

/**
 * Both conditions must hold. A high approval rate alone is not rubber-stamping — a reviewer whose
 * queue is genuinely low-risk should approve nearly everything, and flagging them would train the
 * team to ignore the metric.
 */
export function assessOversight(outcomes: readonly ReviewOutcome[]): OversightHealth {
  const decided = outcomes.filter(
    (outcome) => outcome.kind === "approved" || outcome.kind === "rejected",
  );
  if (decided.length < MIN_SAMPLE) {
    return { kind: "insufficient-sample", reviewed: decided.length };
  }

  const approvals = decided.filter((outcome) => outcome.kind === "approved").length;
  const approvalRate = approvals / decided.length;
  const medianMs = median(decided.map((outcome) => outcome.tookMs));

  return approvalRate >= RUBBER_STAMP_APPROVAL_RATE && medianMs < RUBBER_STAMP_MEDIAN_MS
    ? { kind: "rubber-stamping", approvalRate, medianMs }
    : { kind: "healthy", approvalRate, medianMs };
}
