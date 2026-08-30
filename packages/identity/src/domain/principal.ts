import type { Brand, TenantId } from "@custodian/domain-primitives";

export type PrincipalId = Brand<string, "PrincipalId">;

/**
 * Every execution-log entry names the authenticated principal that triggered it — human or agent
 * (Compliance_and_Certification.txt:51). Modelling this as a union rather than a record with
 * nullable columns means "an agent with no card" cannot be constructed.
 */
export type Principal =
  | { readonly kind: "human"; readonly id: PrincipalId; readonly tenant: TenantId }
  | {
      readonly kind: "agent";
      readonly id: PrincipalId;
      readonly tenant: TenantId;
      readonly card: string;
    }
  | { readonly kind: "service"; readonly id: PrincipalId };
