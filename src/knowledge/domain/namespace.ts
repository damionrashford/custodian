import { brand } from "@custodian/primitives";
import type { Namespace } from "@custodian/primitives";
import type { VerifiedTenantClaim } from "./tenant-claim";

export function namespaceFor(claim: VerifiedTenantClaim): Namespace {
  return brand<Namespace>(`tenant:${claim.tenant}`);
}
