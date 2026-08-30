import { expect, test } from "bun:test";
import {
  parsePromptVersion,
  promote,
  publish,
  resolve,
  rollback,
  type PromptSnapshot,
  type Registry,
} from "@custodian/config-registry";

function version(value: string) {
  const parsed = parsePromptVersion(value);
  if (!parsed.ok) throw new Error(`fixture: bad version ${value}`);
  return parsed.value;
}

const V1 = version("pv_01jd7k9h2m4n6p8r0s2t4v6x8z");
const V2 = version("pv_02jd7k9h2m4n6p8r0s2t4v6x8z");

function snapshot(v: typeof V1, text: string): PromptSnapshot {
  return {
    version: v,
    text,
    model: "frontier-1.5-20260801",
    parameters: { temperature: 0.2 },
    changeSource: "ticket CUS-114",
    rationale: "tighten refusal boundary on payment questions",
    evalPassCaret: 0.92,
    createdAt: "2026-08-29T00:00:00.000Z",
  };
}

const EMPTY: Registry = { versions: new Map(), labels: new Map() };

function twoVersionsLive() {
  const withV1 = publish(EMPTY, snapshot(V1, "you are careful"));
  const withV2 = publish(withV1, snapshot(V2, "you are very careful"));
  const promoted = promote(withV2, "production", V2);
  if (!promoted.ok) throw new Error("fixture: promote failed");
  return promoted.value;
}

test("a label resolves to the snapshot it points at", () => {
  const resolved = resolve(twoVersionsLive(), "production");
  expect(resolved.ok).toBe(true);
  if (!resolved.ok) return;
  expect(resolved.value.text).toBe("you are very careful");
});

test("promoting a label does not alter any version — history is immutable", () => {
  const registry = twoVersionsLive();
  const before = registry.versions.get(V1);
  const promoted = promote(registry, "production", V1);
  if (!promoted.ok) throw new Error("promote failed");

  expect(promoted.value.versions.get(V1)).toEqual(before);
  expect(promoted.value.versions.size).toBe(2);
});

test("a label cannot point at a version that was never published", () => {
  expect(promote(EMPTY, "production", V1)).toEqual({
    ok: false,
    error: { kind: "unknown-version", version: V1 },
  });
});

test("resolving an unset label is an error, not a silent default", () => {
  expect(resolve(twoVersionsLive(), "canary")).toEqual({
    ok: false,
    error: { kind: "label-unset", label: "canary" },
  });
});

test("rollback repoints the label and leaves the rolled-back version in history", () => {
  const rolled = rollback(twoVersionsLive(), "production", V1);
  expect(rolled.ok).toBe(true);
  if (!rolled.ok) return;

  expect(rolled.value.restored).toBe(V1);
  // The bad version is still recorded — it is the record of what production was running.
  expect(rolled.value.registry.versions.has(V2)).toBe(true);
});

test("rollback names the caches that must be invalidated as part of the rollback", () => {
  const rolled = rollback(twoVersionsLive(), "production", V1);
  if (!rolled.ok) throw new Error("rollback failed");

  // A cache that outlives a rollback extends the incident.
  expect(rolled.value.mustInvalidate).toEqual(["response-cache", "routing-memory"]);
});

test("rolling back to the version already deployed is refused", () => {
  expect(rollback(twoVersionsLive(), "production", V2)).toEqual({
    ok: false,
    error: { kind: "no-previous-version", label: "production" },
  });
});

test("a snapshot records everything needed to roll back without guessing", () => {
  const resolved = resolve(twoVersionsLive(), "production");
  if (!resolved.ok) throw new Error("resolve failed");

  // Omitting any of these means rolling back blindly.
  for (const field of [
    "text",
    "model",
    "parameters",
    "changeSource",
    "rationale",
    "evalPassCaret",
  ] as const) {
    expect([field, resolved.value[field]]).not.toEqual([field, undefined]);
  }
});

test("canary and production are independent labels over the same history", () => {
  const registry = twoVersionsLive();
  const withCanary = promote(registry, "canary", V1);
  if (!withCanary.ok) throw new Error("promote failed");

  const canary = resolve(withCanary.value, "canary");
  const production = resolve(withCanary.value, "production");
  if (!canary.ok || !production.ok) throw new Error("resolve failed");

  expect(canary.value.version).toBe(V1);
  expect(production.value.version).toBe(V2);
});
