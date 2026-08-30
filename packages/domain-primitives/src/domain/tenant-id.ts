import type { Brand } from "./brand";
import { err, ok, type Result } from "./result";

export type TenantId = Brand<string, "TenantId">;

export type InvalidTenantId = {
  readonly kind: "invalid-tenant-id";
  readonly received: string;
};

const TENANT_ID_PATTERN = /^t_[0-9a-z]{26}$/;

/**
 * The single boundary where an unvalidated string becomes a TenantId. The assertion is the parser
 * exception the standard names (Engineering_Standards.txt:82) — no other module can construct one,
 * which is the whole point.
 */
export function parseTenantId(value: string): Result<TenantId, InvalidTenantId> {
  if (!TENANT_ID_PATTERN.test(value)) {
    return err({ kind: "invalid-tenant-id", received: value });
  }
  return ok(value as TenantId);
}
