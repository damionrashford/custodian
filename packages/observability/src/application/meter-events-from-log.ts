import type { LoggedEntry } from "@custodian/execution-log";
import type { SourceTotal } from "@custodian/reconciliation";
import { meterTotalMicros, type MeterEvent } from "../domain/meter-event";

/**
 * The meter-events side of reconcile()'s three required sources, derived from the execution log —
 * the log's usage field group exists to be "reconcilable to the billing ledger"
 * (Compliance_and_Certification.txt:58), and deriving rather than double-writing means the meter
 * can never disagree with the evidence record about what was metered.
 */
export function meterEventsFrom(log: readonly LoggedEntry[]): readonly MeterEvent[] {
  return log.flatMap((entry) =>
    entry.event.kind === "usage-recorded"
      ? [
          {
            runId: entry.runId,
            at: entry.at,
            inputTokens: entry.event.inputTokens,
            outputTokens: entry.event.outputTokens,
            costMicros: entry.event.costMicros,
          },
        ]
      : [],
  );
}

/**
 * Half-open period [start, end): two adjacent windows never both count a boundary event.
 * Lexicographic comparison is exact here because every timestamp in the log is a fixed-width UTC
 * ISO string. Timezone mismatch at a date boundary is a documented divergence cause
 * (AI_Agent_Implementation_Plan_v2.txt:119).
 */
export function sourceTotalFrom(
  events: readonly MeterEvent[],
  periodStart: string,
  periodEnd: string,
): SourceTotal {
  const inPeriod = events.filter((event) => event.at >= periodStart && event.at < periodEnd);
  return {
    source: "meter-events",
    periodStart,
    periodEnd,
    totalMicros: meterTotalMicros(inPeriod),
  };
}
