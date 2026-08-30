import { brand } from "@custodian/domain-primitives";
import type { Namespace } from "@custodian/domain-primitives";
import type { VerifiedTenantClaim } from "./tenant-claim";

export function namespaceFor(claim: VerifiedTenantClaim): Namespace {
  return brand<Namespace>(`tenant:${claim.tenant}`);
}
