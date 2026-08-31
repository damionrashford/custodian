import { err, ok, type Result } from "@custodian/primitives";

export type BudgetExhausted = {
  readonly kind: "budget-exhausted";
  readonly spent: number;
  readonly requested: number;
  readonly ceiling: number;
};

/**
 * Refused rather than clamped: a partially-funded call still costs money and still produces a side
 * effect. Cost per resolved interaction is an SLI, so a breach is a signal, not something to
 * silently absorb (gap-register.txt:290).
 */
export function chargeBudget(
  spent: number,
  requested: number,
  ceiling: number,
): Result<number, BudgetExhausted> {
  const total = spent + requested;
  return total > ceiling ? err({ kind: "budget-exhausted", spent, requested, ceiling }) : ok(total);
}
