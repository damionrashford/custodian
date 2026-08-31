/**
 * Reconciliation is the load-bearing component, not a closing step
 * (implementation-plan.txt:119). Documented causes of divergence: events lost to network
 * partitions, events double-counted from a retry without idempotency, provider changes to
 * token-counting rules, and timezone mismatches at date boundaries.
 *
 * The reconciliation job is the difference between a pipeline that is correct and one that merely
 * believes it is — so a discrepancy alerts rather than logs
 * (implementation-plan.txt:257).
 */
export type CostSource = "provider-invoice" | "meter-events" | "internal-ledger";

export type SourceTotal = {
  readonly source: CostSource;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly totalMicros: number;
};

export type Discrepancy = {
  readonly left: CostSource;
  readonly right: CostSource;
  readonly differenceMicros: number;
  /** Absolute difference as a fraction of the larger side. */
  readonly relative: number;
};

export type ReconciliationOutcome =
  | { readonly kind: "reconciled"; readonly totalMicros: number }
  | { readonly kind: "alert"; readonly discrepancies: readonly Discrepancy[] }
  | {
      readonly kind: "not-comparable";
      readonly reason: "period-mismatch" | "missing-source";
      readonly detail: string;
    };

const REQUIRED_SOURCES: readonly CostSource[] = [
  "provider-invoice",
  "meter-events",
  "internal-ledger",
];

/**
 * Zero tolerance by default. The definition of done requires the cost dashboard to reconcile against
 * the provider invoice and billing ledger with **zero unexplained variance** for two consecutive
 * billing cycles (implementation-plan.txt:282), so a non-zero default would be a
 * standing exception to the acceptance criterion.
 */
export const DEFAULT_TOLERANCE = 0;

function pairsOf(totals: readonly SourceTotal[]): readonly (readonly [SourceTotal, SourceTotal])[] {
  const pairs: (readonly [SourceTotal, SourceTotal])[] = [];
  for (let i = 0; i < totals.length; i += 1) {
    for (let j = i + 1; j < totals.length; j += 1) {
      const left = totals[i];
      const right = totals[j];
      if (left !== undefined && right !== undefined) {
        pairs.push([left, right]);
      }
    }
  }
  return pairs;
}

/**
 * Periods are compared before totals. A timezone mismatch at a date boundary is a documented cause
 * of divergence, and comparing two different windows would report it as a cost discrepancy — sending
 * an on-call engineer after a billing bug that is really a clock bug.
 */
export function reconcile(
  totals: readonly SourceTotal[],
  tolerance: number = DEFAULT_TOLERANCE,
): ReconciliationOutcome {
  const missing = REQUIRED_SOURCES.filter(
    (source) => !totals.some((total) => total.source === source),
  );
  if (missing.length > 0) {
    return { kind: "not-comparable", reason: "missing-source", detail: missing.join(", ") };
  }

  const first = totals[0];
  if (first === undefined) {
    return { kind: "not-comparable", reason: "missing-source", detail: "no totals" };
  }
  const mismatched = totals.find(
    (total) => total.periodStart !== first.periodStart || total.periodEnd !== first.periodEnd,
  );
  if (mismatched !== undefined) {
    return {
      kind: "not-comparable",
      reason: "period-mismatch",
      detail: `${mismatched.source} covers ${mismatched.periodStart}..${mismatched.periodEnd}`,
    };
  }

  const discrepancies = pairsOf(totals)
    .map(([left, right]) => {
      const differenceMicros = Math.abs(left.totalMicros - right.totalMicros);
      const larger = Math.max(left.totalMicros, right.totalMicros);
      return {
        left: left.source,
        right: right.source,
        differenceMicros,
        relative: larger === 0 ? 0 : differenceMicros / larger,
      };
    })
    .filter((discrepancy) => discrepancy.differenceMicros > tolerance);

  return discrepancies.length === 0
    ? { kind: "reconciled", totalMicros: first.totalMicros }
    : { kind: "alert", discrepancies };
}
