import type { ProviderProfile } from "./provider-profile";
import type { ProviderId } from "@custodian/primitives";
import type { Region } from "@custodian/primitives";

export type RoutingRequest = {
  readonly tenantRegion: Region;
  readonly requiresZeroRetention: boolean;
  readonly candidates: readonly ProviderProfile[];
  readonly attempted: readonly ProviderId[];
};

export type RoutingDecision =
  | { readonly kind: "route"; readonly provider: ProviderId; readonly rationale: string }
  | {
      readonly kind: "refuse";
      readonly reason: "no-eligible-in-region-provider" | "all-eligible-exhausted";
      readonly rationale: string;
    };

function isEligible(provider: ProviderProfile, request: RoutingRequest): boolean {
  if (provider.processingRegion !== request.tenantRegion) return false;
  if (provider.storageRegion !== request.tenantRegion) return false;
  if (request.requiresZeroRetention && !provider.zeroRetention) return false;
  return provider.healthy;
}

/**
 * Residency is a routing constraint, not a configuration flag. The fallback chain must not silently
 * route an EU tenant to a non-EU provider during a failover, so exhausting the in-region set
 * returns a refusal rather than widening the candidate set
 * (Data_Protection_and_Retention.txt:145-150).
 *
 * The rationale is not decoration: the execution log records the router decision and its rationale
 * for every call (Compliance_and_Certification.txt:55).
 */
export function selectProvider(request: RoutingRequest): RoutingDecision {
  const eligible = request.candidates.filter((provider) => isEligible(provider, request));

  if (eligible.length === 0) {
    return {
      kind: "refuse",
      reason: "no-eligible-in-region-provider",
      rationale: `No provider processes and stores in ${request.tenantRegion} under the required terms.`,
    };
  }

  const remaining = eligible.filter((provider) => !request.attempted.includes(provider.id));
  const next = remaining[0];

  if (next === undefined) {
    return {
      kind: "refuse",
      reason: "all-eligible-exhausted",
      rationale: `All ${String(eligible.length)} eligible providers in ${request.tenantRegion} were attempted.`,
    };
  }

  return {
    kind: "route",
    provider: next.id,
    rationale: `Eligible in ${request.tenantRegion}; attempt ${String(request.attempted.length + 1)} of ${String(eligible.length)}.`,
  };
}
