import type { RunState } from "../domain/loop-controls";

export type StepEffect =
  | { readonly kind: "observed-new-evidence" }
  | { readonly kind: "observed-nothing-new" }
  | { readonly kind: "step-unparseable" }
  | { readonly kind: "tool-failed" };

/**
 * observed-new-evidence is the only effect that counts as progress. A tool that succeeds but
 * returns nothing new is the documented stagnation pathology — repeating a sequence without the
 * state changing (architecture-addendum.txt:120) — and a failed tool leaves the action
 * unverified, which evaluateLoop halts on first because acting on unconfirmed state produces
 * wrong side effects, not just wasted spend.
 */
export function advance(state: RunState, effect: StepEffect, stepCostMicros: number): RunState {
  const iteration = state.iteration + 1;
  const costMicros = state.costMicros + stepCostMicros;
  switch (effect.kind) {
    case "observed-new-evidence":
      return { iteration, stepsWithoutStateChange: 0, costMicros, lastActionVerified: true };
    case "observed-nothing-new":
    case "step-unparseable":
      return {
        iteration,
        stepsWithoutStateChange: state.stepsWithoutStateChange + 1,
        costMicros,
        lastActionVerified: true,
      };
    case "tool-failed":
      return {
        iteration,
        stepsWithoutStateChange: state.stepsWithoutStateChange + 1,
        costMicros,
        lastActionVerified: false,
      };
    default: {
      const unhandled: never = effect;
      return unhandled;
    }
  }
}
