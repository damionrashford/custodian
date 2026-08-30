import type { Brand } from "@custodian/domain-primitives";
import type { VerifiedTenantClaim } from "./tenant-claim";

/**
 * Namespace-per-tenant rather than metadata filtering: query cost is a function of namespace size,
 * offboarding becomes a single delete, and approximate-nearest-neighbour structures in a shared
 * index are built from the entire dataset, leaving hidden coupling between tenants
 * (AI_Agent_Implementation_Plan_v2.txt:156-157).
 *
 * There is deliberately no constructor from a string. The only way to obtain a Namespace is to
 * derive it from a verified claim, so a caller has no vocabulary for naming another tenant's
 * namespace — a stronger guarantee than checking a parameter after the fact.
 */
export type Namespace = Brand<string, "Namespace">;

export function namespaceFor(claim: VerifiedTenantClaim): Namespace {
  return `tenant:${claim.tenant}` as Namespace;
}
