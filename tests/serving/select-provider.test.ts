import { expect, test } from "bun:test";
import { selectProvider, type ProviderProfile } from "@custodian/serving";
import { parseRegion } from "@custodian/primitives";
import { parseProviderId } from "@custodian/primitives";

function region(value: string) {
  const parsed = parseRegion(value);
  if (!parsed.ok) throw new Error(`fixture: bad region ${value}`);
  return parsed.value;
}

function providerId(value: string) {
  const parsed = parseProviderId(value);
  if (!parsed.ok) throw new Error(`fixture: bad provider id ${value}`);
  return parsed.value;
}

const EU_PRIMARY: ProviderProfile = {
  id: providerId("eu-primary"),
  processingRegion: region("eu-west-1"),
  storageRegion: region("eu-west-1"),
  zeroRetention: true,
  healthy: true,
};

const EU_SECONDARY: ProviderProfile = {
  ...EU_PRIMARY,
  id: providerId("eu-secondary"),
};

const EU_NO_ZDR: ProviderProfile = {
  ...EU_PRIMARY,
  id: providerId("eu-no-zdr"),
  zeroRetention: false,
};

const US_FALLBACK: ProviderProfile = {
  id: providerId("us-fallback"),
  processingRegion: region("us-east-1"),
  storageRegion: region("us-east-1"),
  zeroRetention: true,
  healthy: true,
};

test("an in-region provider is selected and the decision carries a rationale", () => {
  const decision = selectProvider({
    tenantRegion: region("eu-west-1"),
    requiresZeroRetention: true,
    candidates: [US_FALLBACK, EU_PRIMARY],
    attempted: [],
  });

  expect(decision.kind).toBe("route");
  if (decision.kind !== "route") return;
  expect(decision.provider).toEqual(EU_PRIMARY.id);
  expect(decision.rationale.length).toBeGreaterThan(0);
});

test("failover moves to the next in-region provider, not out of region", () => {
  const decision = selectProvider({
    tenantRegion: region("eu-west-1"),
    requiresZeroRetention: true,
    candidates: [EU_PRIMARY, EU_SECONDARY, US_FALLBACK],
    attempted: [EU_PRIMARY.id],
  });

  expect(decision.kind).toBe("route");
  if (decision.kind !== "route") return;
  expect(decision.provider).toEqual(EU_SECONDARY.id);
});

test("exhausting every in-region provider REFUSES rather than crossing the boundary", () => {
  const decision = selectProvider({
    tenantRegion: region("eu-west-1"),
    requiresZeroRetention: true,
    candidates: [EU_PRIMARY, EU_SECONDARY, US_FALLBACK],
    attempted: [EU_PRIMARY.id, EU_SECONDARY.id],
  });

  expect(decision.kind).toBe("refuse");
  if (decision.kind !== "refuse") return;
  expect(decision.reason).toBe("all-eligible-exhausted");
});

test("no in-region provider at all refuses, and never names the out-of-region one", () => {
  const decision = selectProvider({
    tenantRegion: region("eu-west-1"),
    requiresZeroRetention: true,
    candidates: [US_FALLBACK],
    attempted: [],
  });

  expect(decision).toEqual({
    kind: "refuse",
    reason: "no-eligible-in-region-provider",
    rationale: "No provider processes and stores in eu-west-1 under the required terms.",
  });
});

test("a provider without a zero-retention arrangement is not eligible for EU traffic", () => {
  const decision = selectProvider({
    tenantRegion: region("eu-west-1"),
    requiresZeroRetention: true,
    candidates: [EU_NO_ZDR],
    attempted: [],
  });

  expect(decision.kind).toBe("refuse");
});

test("an unhealthy in-region provider is skipped but does not license a cross-border call", () => {
  const decision = selectProvider({
    tenantRegion: region("eu-west-1"),
    requiresZeroRetention: true,
    candidates: [{ ...EU_PRIMARY, healthy: false }, US_FALLBACK],
    attempted: [],
  });

  expect(decision.kind).toBe("refuse");
});

test("storage in region but processing elsewhere is not in region", () => {
  const split: ProviderProfile = { ...EU_PRIMARY, processingRegion: region("us-east-1") };
  const decision = selectProvider({
    tenantRegion: region("eu-west-1"),
    requiresZeroRetention: true,
    candidates: [split],
    attempted: [],
  });

  expect(decision.kind).toBe("refuse");
});
