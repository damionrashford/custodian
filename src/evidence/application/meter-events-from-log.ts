import type { LoggedEntry } from "../domain/logged-entry";
import type { SourceTotal } from "../domain/reconcile";
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
 * Boundaries compare as instants, not strings — an invoice period written without milliseconds or
 * with a zone offset names the same instant as the log's fixed-width form, and a string comparison
 * would misfile the boundary event. Timezone mismatch at a date boundary is a documented
 * divergence cause (AI_Agent_Implementation_Plan_v2.txt:119).
 */
export function sourceTotalFrom(
  events: readonly MeterEvent[],
  periodStart: string,
  periodEnd: string,
): SourceTotal {
  const start = Date.parse(periodStart);
  const end = Date.parse(periodEnd);
  const inPeriod = events.filter((event) => {
    const at = Date.parse(event.at);
    return at >= start && at < end;
  });
  return {
    source: "meter-events",
    periodStart,
    periodEnd,
    totalMicros: meterTotalMicros(inPeriod),
  };
}
