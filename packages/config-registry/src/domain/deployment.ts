import { err, ok, type PromptVersion, type Result } from "@custodian/domain-primitives";
import type { PromptSnapshot } from "./prompt-version";

/** The mutable half: a label declaring what production currently runs. */
export type DeploymentLabel = "production" | "canary" | "shadow";

export type Registry = {
  readonly versions: ReadonlyMap<PromptVersion, PromptSnapshot>;
  readonly labels: ReadonlyMap<DeploymentLabel, PromptVersion>;
};

export type RegistryFailure =
  | { readonly kind: "unknown-version"; readonly version: PromptVersion }
  | { readonly kind: "label-unset"; readonly label: DeploymentLabel }
  | { readonly kind: "no-previous-version"; readonly label: DeploymentLabel };

/**
 * Rolling back means repointing a label at an existing snapshot. It never edits a version, because
 * a version is history — editing one would destroy the record of what production was running when
 * the incident happened, which is the record the rollback exists to restore.
 */
export type Rollback = {
  readonly registry: Registry;
  readonly restored: PromptVersion;
  /**
   * Cache and routing-memory invalidation are steps in the rollback, not follow-up cleanup. A
   * documented incident had the semantic cache serving the bad answer for forty minutes after the
   * rollback (Reliability_and_Operations.txt:116-117).
   */
  readonly mustInvalidate: readonly ["response-cache", "routing-memory"];
};

export function publish(registry: Registry, snapshot: PromptSnapshot): Registry {
  const versions = new Map(registry.versions);
  versions.set(snapshot.version, snapshot);
  return { versions, labels: registry.labels };
}

export function promote(
  registry: Registry,
  label: DeploymentLabel,
  version: PromptVersion,
): Result<Registry, RegistryFailure> {
  if (!registry.versions.has(version)) {
    return err({ kind: "unknown-version", version });
  }
  const labels = new Map(registry.labels);
  labels.set(label, version);
  return ok({ versions: registry.versions, labels });
}

export function resolve(
  registry: Registry,
  label: DeploymentLabel,
): Result<PromptSnapshot, RegistryFailure> {
  const version = registry.labels.get(label);
  if (version === undefined) {
    return err({ kind: "label-unset", label });
  }
  const snapshot = registry.versions.get(version);
  return snapshot === undefined ? err({ kind: "unknown-version", version }) : ok(snapshot);
}

/**
 * Rollback is repointing a label, which is why the SLO is achievable: one documented migration took
 * rollback from 14 minutes to 8 seconds by moving the prompt out of the container image and into a
 * registry alias (AI_Agent_Implementation_Plan_v2.txt:232). The target is under 60 seconds.
 */
export function rollback(
  registry: Registry,
  label: DeploymentLabel,
  to: PromptVersion,
): Result<Rollback, RegistryFailure> {
  const current = registry.labels.get(label);
  if (current === undefined) {
    return err({ kind: "label-unset", label });
  }
  if (current === to) {
    return err({ kind: "no-previous-version", label });
  }
  const promoted = promote(registry, label, to);
  return promoted.ok
    ? ok({
        registry: promoted.value,
        restored: to,
        mustInvalidate: ["response-cache", "routing-memory"],
      })
    : err(promoted.error);
}
