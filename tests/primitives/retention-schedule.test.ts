import { expect, test } from "bun:test";
import {
  expiresAt,
  isDueForDisposal,
  RETENTION_SCHEDULE,
  type RetentionClass,
} from "@custodian/primitives";

/**
 * Transcribed from the table in Data_Protection_and_Retention.txt:114-140. This test exists so the
 * schedule cannot drift away from the document it implements without the build failing — a
 * retention period is a legal position, not a tuning parameter.
 */
const SPEC_TABLE: ReadonlyArray<readonly [RetentionClass, number | "tenant-lifetime"]> = [
  ["prompts-and-completions", 30],
  ["execution-log-metadata", 730],
  ["execution-log-content", 30],
  ["vector-index", "tenant-lifetime"],
  ["agent-memory", 365],
  ["billing-records", 2555],
  ["backups", 35],
];

test("every class in the spec table is encoded with the spec's period", () => {
  for (const [retention, expected] of SPEC_TABLE) {
    const rule = RETENTION_SCHEDULE[retention];
    const actual = rule.kind === "tenant-lifetime" ? "tenant-lifetime" : rule.days;
    expect([retention, actual]).toEqual([retention, expected]);
  }
});

test("the schedule holds no class the spec does not name, and omits none it does", () => {
  expect(Object.keys(RETENTION_SCHEDULE).sort()).toEqual(
    SPEC_TABLE.map(([retention]) => retention).sort(),
  );
});

test("the execution log appears twice, because evidence and content have different periods", () => {
  const metadata = RETENTION_SCHEDULE["execution-log-metadata"];
  const content = RETENTION_SCHEDULE["execution-log-content"];
  if (metadata.kind !== "duration" || content.kind !== "duration")
    throw new Error("expected durations");

  expect(metadata.days).toBeGreaterThan(content.days);
});

test("a tenant may shorten debugging retention but not statutory retention", () => {
  const prompts = RETENTION_SCHEDULE["prompts-and-completions"];
  const billing = RETENTION_SCHEDULE["billing-records"];
  if (prompts.kind !== "duration" || billing.kind !== "duration")
    throw new Error("expected durations");

  expect(prompts.tenantConfigurableToZero).toBe(true);
  expect(billing.tenantConfigurableToZero).toBe(false);
});

test("a duration class has a computable expiry", () => {
  expect(expiresAt("prompts-and-completions", "2026-08-29T00:00:00.000Z")).toBe(
    "2026-09-28T00:00:00.000Z",
  );
});

test("a tenant-lifetime class has no clock — it is dropped by an offboarding event", () => {
  expect(expiresAt("vector-index", "2026-08-29T00:00:00.000Z")).toBeUndefined();
  expect(
    isDueForDisposal("vector-index", "2020-01-01T00:00:00.000Z", "2036-01-01T00:00:00.000Z"),
  ).toBe(false);
});

test("disposal is due on the boundary, not after it", () => {
  expect(
    isDueForDisposal(
      "prompts-and-completions",
      "2026-08-29T00:00:00.000Z",
      "2026-09-28T00:00:00.000Z",
    ),
  ).toBe(true);
  expect(
    isDueForDisposal(
      "prompts-and-completions",
      "2026-08-29T00:00:00.000Z",
      "2026-09-27T23:59:59.000Z",
    ),
  ).toBe(false);
});
