import { type Brand, err, ok, type Result } from "@custodian/domain-primitives";

export type Region = Brand<string, "Region">;
export type ProviderId = Brand<string, "ProviderId">;

export type InvalidRegion = { readonly kind: "invalid-region"; readonly received: string };
export type InvalidProviderId = { readonly kind: "invalid-provider-id"; readonly received: string };

const REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d$/;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;

export function parseRegion(value: string): Result<Region, InvalidRegion> {
  return REGION_PATTERN.test(value)
    ? ok(value as Region)
    : err({ kind: "invalid-region", received: value });
}

export function parseProviderId(value: string): Result<ProviderId, InvalidProviderId> {
  return PROVIDER_ID_PATTERN.test(value)
    ? ok(value as ProviderId)
    : err({ kind: "invalid-provider-id", received: value });
}
