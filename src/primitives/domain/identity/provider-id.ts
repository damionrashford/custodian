import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";

export type ProviderId = Brand<string, "ProviderId">;

export type InvalidProviderId = { readonly kind: "invalid-provider-id"; readonly received: string };

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;

export function parseProviderId(value: string): Result<ProviderId, InvalidProviderId> {
  return PROVIDER_ID_PATTERN.test(value)
    ? ok(brand<ProviderId>(value))
    : err({ kind: "invalid-provider-id", received: value });
}
