import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";
import type { TenantId } from "./tenant-id";

export type PrincipalId = Brand<string, "PrincipalId">;

export type InvalidPrincipalId = {
  readonly kind: "invalid-principal-id";
  readonly received: string;
};

const PRINCIPAL_ID_PATTERN = /^[a-z]_[0-9a-z]{4,63}$/;

/**
 * A principal identifier survives in execution-log metadata for 24 months, past the erasure of
 * everything sealed under the subject key. That is only defensible while the identifier is
 * pseudonymous, so the pattern refuses anything shaped like an email address or a name.
 */
export function parsePrincipalId(value: string): Result<PrincipalId, InvalidPrincipalId> {
  return PRINCIPAL_ID_PATTERN.test(value)
    ? ok(brand<PrincipalId>(value))
    : err({ kind: "invalid-principal-id", received: value });
}

/**
 * Every execution-log entry names the authenticated principal that triggered it — human or agent
 * (Compliance_and_Certification.txt:51). Modelling this as a union rather than a record with
 * nullable columns means "an agent with no card" cannot be constructed.
 *
 * An agent principal deliberately carries no card material. A card is verified once at handoff
 * against a nonce ledger (@custodian/serving); copying it into the log would turn the evidentiary
 * artefact into a queryable store of signatures and nonces at rest.
 */
export type Principal =
  | { readonly kind: "human"; readonly id: PrincipalId; readonly tenant: TenantId }
  | { readonly kind: "agent"; readonly id: PrincipalId; readonly tenant: TenantId }
  | { readonly kind: "service"; readonly id: PrincipalId };
