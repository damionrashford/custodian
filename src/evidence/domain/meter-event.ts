import type { RunId } from "@custodian/primitives";

/**
 * One meter event per usage-recorded execution-log entry. Cost is already a pure function of
 * tokens and the price table (@custodian/evidence); the event carries the result so billing can be
 * recomputed offline from the log alone (AI_Agent_Implementation_Plan_v2.txt:121) — which is what
 * makes the log the source for reconcile()'s meter-events side.
 */
export type MeterEvent = {
  readonly runId: RunId;
  readonly at: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicros: number;
};

export function meterTotalMicros(events: readonly MeterEvent[]): number {
  return events.reduce((total, event) => total + event.costMicros, 0);
}
