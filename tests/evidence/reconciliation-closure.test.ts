import { expect, test } from "bun:test";
import { parseRunId } from "@custodian/primitives";
import { appendEntry, Sha256ContentHasher, type LoggedEntry } from "@custodian/evidence";
import { meterEventsFrom, sourceTotalFrom } from "@custodian/evidence";
import { reconcile } from "@custodian/evidence";

const hasher = new Sha256ContentHasher();
const START = "2026-08-01T00:00:00.000Z";
const END = "2026-09-01T00:00:00.000Z";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

function usageRun(at: string, costs: readonly number[]): readonly LoggedEntry[] {
  const runId = must(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");
  let log: readonly LoggedEntry[] = [];
  for (const costMicros of costs) {
    log = must(
      appendEntry(
        log,
        { kind: "usage-recorded", invocationSeq: 0, inputTokens: 10, outputTokens: 20, costMicros },
        { runId, at, hasher },
      ),
      "append",
    );
  }
  return log;
}

test("a run log reconciles against invoice and ledger with zero variance", () => {
  // The Definition of Done line this whole path exists for: "cost dashboard reconciles against the
  // provider invoice and billing ledger with zero unexplained variance"
  // (implementation-plan.txt:282). Before meterEventsFrom, nothing produced the
  // meter-events source, so reconcile() could only ever answer not-comparable on gateway traffic.
  const log = usageRun("2026-08-15T12:00:00.000Z", [1200, 800]);
  const meter = sourceTotalFrom(meterEventsFrom(log), START, END);
  const outcome = reconcile([
    { source: "provider-invoice", periodStart: START, periodEnd: END, totalMicros: 2000 },
    meter,
    { source: "internal-ledger", periodStart: START, periodEnd: END, totalMicros: 2000 },
  ]);
  expect(outcome).toEqual({ kind: "reconciled", totalMicros: 2000 });
});

test("a usage event missing from the log alerts instead of reconciling", () => {
  // The gate proven able to fail with its idiomatic violation (LD-4): a lost meter event is the
  // documented real-world failure — "events lost to network partitions"
  // (implementation-plan.txt:119) — not an artificial one.
  const log = usageRun("2026-08-15T12:00:00.000Z", [1200]);
  const meter = sourceTotalFrom(meterEventsFrom(log), START, END);
  const outcome = reconcile([
    { source: "provider-invoice", periodStart: START, periodEnd: END, totalMicros: 2000 },
    meter,
    { source: "internal-ledger", periodStart: START, periodEnd: END, totalMicros: 2000 },
  ]);
  expect(outcome.kind).toBe("alert");
});
