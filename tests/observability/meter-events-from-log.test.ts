import { expect, test } from "bun:test";
import { parseRunId } from "@custodian/domain-primitives";
import { appendEntry, Sha256ContentHasher, type LoggedEntry } from "@custodian/execution-log";
import { meterEventsFrom, sourceTotalFrom } from "@custodian/observability";

const hasher = new Sha256ContentHasher();

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
        { kind: "usage-recorded", inputTokens: 10, outputTokens: 20, costMicros },
        { runId, at, hasher },
      ),
      "append",
    );
  }
  return log;
}

test("only usage-recorded entries become meter events, carrying tokens and cost", () => {
  const runId = must(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");
  let log = usageRun("2026-08-15T12:00:00.000Z", [1200, 800]);
  log = must(
    appendEntry(
      log,
      { kind: "guardrail-evaluated", policy: "p", rule: "r", outcome: "allowed" },
      { runId, at: "2026-08-15T12:00:00.000Z", hasher },
    ),
    "append",
  );

  const events = meterEventsFrom(log);
  expect(events).toHaveLength(2);
  expect(events[0]?.costMicros).toBe(1200);
  expect(events[1]?.costMicros).toBe(800);
  expect(events[1]?.inputTokens).toBe(10);
  expect(events[1]?.outputTokens).toBe(20);
});

test("the period is half-open: a boundary event lands in exactly one window", () => {
  // Double-counting at boundaries is a documented divergence cause
  // (AI_Agent_Implementation_Plan_v2.txt:119); [start, end) is what prevents it structurally.
  const events = meterEventsFrom(usageRun("2026-09-01T00:00:00.000Z", [500]));
  const august = sourceTotalFrom(events, "2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
  const september = sourceTotalFrom(events, "2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");
  expect(august.totalMicros).toBe(0);
  expect(september.totalMicros).toBe(500);
  expect(september.source).toBe("meter-events");
});
