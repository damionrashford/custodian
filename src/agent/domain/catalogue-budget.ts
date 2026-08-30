import { err, ok, type Result } from "@custodian/primitives";

/**
 * Tool count is a quality metric, not a feature count — selection accuracy fell from 43% to below
 * 14% as the catalogue grew (Agent_Architecture_Addendum.txt:128). Adding past the budget requires
 * a removal, which is why this returns how many must go rather than a bare boolean.
 */
export const TOOL_CATALOGUE_BUDGET = 40;

export type BudgetExceeded = {
  readonly kind: "tool-budget-exceeded";
  readonly count: number;
  readonly budget: number;
  readonly mustRemove: number;
};

export function assertWithinBudget(count: number): Result<number, BudgetExceeded> {
  if (count > TOOL_CATALOGUE_BUDGET) {
    return err({
      kind: "tool-budget-exceeded",
      count,
      budget: TOOL_CATALOGUE_BUDGET,
      mustRemove: count - TOOL_CATALOGUE_BUDGET,
    });
  }
  return ok(count);
}
