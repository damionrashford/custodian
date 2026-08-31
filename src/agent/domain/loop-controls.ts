/**
 * Agent loops break at the perceive or observe step rather than at reasoning. The three dominant
 * production failure modes are runaway repetition, context degrading across iterations, and action
 * taken on unverified output (architecture-addendum.txt:120).
 *
 * The pathology worth instrumenting specifically: the agent repeats a failed action sequence
 * without verifying whether the expected state transition actually occurred, producing prolonged
 * stagnation. These are runtime controls, not dashboard metrics
 * (reliability-and-operations.txt:91).
 */
export type RunState = {
  readonly iteration: number;
  /** Consecutive steps that produced no observable state change. */
  readonly stepsWithoutStateChange: number;
  readonly costMicros: number;
  /** False when the previous action's effect was never confirmed. */
  readonly lastActionVerified: boolean;
};

export type LoopLimits = {
  readonly maxIterations: number;
  readonly maxStepsWithoutProgress: number;
  readonly costCeilingMicros: number;
};

export const DEFAULT_LOOP_LIMITS: LoopLimits = {
  maxIterations: 25,
  maxStepsWithoutProgress: 3,
  costCeilingMicros: 2_000_000,
};

export type LoopVerdict =
  { readonly kind: "continue" } | { readonly kind: "halt"; readonly reason: HaltReason };

export type HaltReason = "iteration-ceiling" | "stagnating" | "cost-ceiling" | "unverified-action";

/**
 * Ordered by blast radius, not by likelihood. An unverified action is checked before the cheaper
 * counters because acting on unconfirmed state is the failure that produces wrong side effects
 * rather than merely wasted spend.
 */
export function evaluateLoop(state: RunState, limits: LoopLimits): LoopVerdict {
  if (!state.lastActionVerified) {
    return { kind: "halt", reason: "unverified-action" };
  }
  if (state.costMicros >= limits.costCeilingMicros) {
    return { kind: "halt", reason: "cost-ceiling" };
  }
  if (state.stepsWithoutStateChange >= limits.maxStepsWithoutProgress) {
    return { kind: "halt", reason: "stagnating" };
  }
  if (state.iteration >= limits.maxIterations) {
    return { kind: "halt", reason: "iteration-ceiling" };
  }
  return { kind: "continue" };
}
