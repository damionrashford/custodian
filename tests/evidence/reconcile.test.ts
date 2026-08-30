import { expect, test } from "bun:test";
import { DEFAULT_TOLERANCE, reconcile, type SourceTotal } from "@custodian/evidence";

const START = "2026-08-01T00:00:00.000Z";
const END = "2026-09-01T00:00:00.000Z";

function total(source: SourceTotal["source"], totalMicros: number, end = END): SourceTotal {
  return { source, periodStart: START, periodEnd: end, totalMicros };
}

const AGREEING: readonly SourceTotal[] = [
  total("provider-invoice", 12_500_000),
  total("meter-events", 12_500_000),
  total("internal-ledger", 12_500_000),
];

test("three agreeing sources reconcile", () => {
  expect(reconcile(AGREEING)).toEqual({ kind: "reconciled", totalMicros: 12_500_000 });
});

test("the default tolerance is zero, matching the definition of done", () => {
  expect(DEFAULT_TOLERANCE).toBe(0);
});

test("a single micro of divergence alerts — zero unexplained variance means zero", () => {
  const outcome = reconcile([
    total("provider-invoice", 12_500_001),
    total("meter-events", 12_500_000),
    total("internal-ledger", 12_500_000),
  ]);
  expect(outcome.kind).toBe("alert");
});

test("the alert names both sides, so an operator knows which pair disagrees", () => {
  const outcome = reconcile([
    total("provider-invoice", 13_000_000),
    total("meter-events", 12_500_000),
    total("internal-ledger", 12_500_000),
  ]);
  if (outcome.kind !== "alert") throw new Error("expected an alert");

  // Invoice disagrees with both others; meter and ledger agree with each other.
  expect(outcome.discrepancies).toHaveLength(2);
  for (const discrepancy of outcome.discrepancies) {
    expect(discrepancy.left).toBe("provider-invoice");
    expect(discrepancy.differenceMicros).toBe(500_000);
  }
});

test("a mismatched period is not comparable, and is not reported as a cost discrepancy", () => {
  // A timezone slip at the boundary is a clock bug, not a billing bug. Reporting it as one sends
  // an on-call engineer after the wrong thing.
  const outcome = reconcile([
    total("provider-invoice", 12_500_000),
    total("meter-events", 12_500_000, "2026-08-31T23:00:00.000Z"),
    total("internal-ledger", 12_500_000),
  ]);
  expect(outcome).toEqual({
    kind: "not-comparable",
    reason: "period-mismatch",
    detail: "meter-events covers 2026-08-01T00:00:00.000Z..2026-08-31T23:00:00.000Z",
  });
});

test("a missing source is not comparable — two agreeing sources are not a reconciliation", () => {
  const outcome = reconcile([
    total("provider-invoice", 12_500_000),
    total("meter-events", 12_500_000),
  ]);
  expect(outcome).toEqual({
    kind: "not-comparable",
    reason: "missing-source",
    detail: "internal-ledger",
  });
});

test("an explicit tolerance is honoured, but has to be asked for", () => {
  const nearlyAgreeing = [
    total("provider-invoice", 12_500_100),
    total("meter-events", 12_500_000),
    total("internal-ledger", 12_500_000),
  ];
  expect(reconcile(nearlyAgreeing).kind).toBe("alert");
  expect(reconcile(nearlyAgreeing, 1_000).kind).toBe("reconciled");
});

test("the relative size of a discrepancy is reported alongside the absolute", () => {
  const outcome = reconcile([
    total("provider-invoice", 20_000_000),
    total("meter-events", 10_000_000),
    total("internal-ledger", 10_000_000),
  ]);
  if (outcome.kind !== "alert") throw new Error("expected an alert");
  expect(outcome.discrepancies[0]?.relative).toBe(0.5);
});
