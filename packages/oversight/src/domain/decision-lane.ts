/**
 * Risk-tiered decision lanes with SLAs. On timeout, fail safe to denied and capture partial context
 * for audit (Gap_Register_v2.txt:317, Reliability_and_Operations.txt:193-208).
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
};

export const LANE_POLICIES: Readonly<Record<Lane, LanePolicy>> = {
  fast: { slaMs: 10_000, onTimeout: "auto-approve" },
  standard: { slaMs: 5 * 60_000, onTimeout: "deny" },
  high: { slaMs: 30 * 60_000, onTimeout: "deny" },
};

export type ActionClass =
  "low-risk-reversible" | "sensitive-data-access" | "financial-or-irreversible";

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
export function resolve(request: ReviewRequest, outcome: ReviewOutcome): Resolution {
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
