import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";

export type Region = Brand<string, "Region">;

export type InvalidRegion = { readonly kind: "invalid-region"; readonly received: string };

const REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d$/;

export function parseRegion(value: string): Result<Region, InvalidRegion> {
  return REGION_PATTERN.test(value)
    ? ok(brand<Region>(value))
    : err({ kind: "invalid-region", received: value });
}
