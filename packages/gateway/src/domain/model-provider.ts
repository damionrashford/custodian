import { type Brand, err, ok, type Result } from "@custodian/domain-primitives";
import type { ProviderId } from "@custodian/routing";

/**
 * A pinned snapshot, never a rolling alias. A call site on an alias cannot answer which side of a
 * retirement date it sits on, and the config registry doubles as the model inventory
 * (Gap_Register_v2.txt:189).
 */
export type ModelSnapshot = Brand<string, "ModelSnapshot">;

export type InvalidModelSnapshot = {
  readonly kind: "invalid-model-snapshot";
  readonly received: string;
};

const MODEL_SNAPSHOT_PATTERN = /^[a-z0-9][a-z0-9.-]*-\d{8}$/;

export function parseModelSnapshot(value: string): Result<ModelSnapshot, InvalidModelSnapshot> {
  return MODEL_SNAPSHOT_PATTERN.test(value)
    ? ok(value as ModelSnapshot)
    : err({ kind: "invalid-model-snapshot", received: value });
}

export type CompletionRequest = {
  readonly model: ModelSnapshot;
  readonly prompt: string;
  readonly maxOutputTokens: number;
};

export type CompletionUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type CompletionResponse = {
  readonly text: string;
  readonly usage: CompletionUsage;
};

export type ProviderFailure =
  | { readonly kind: "rate-limited"; readonly retryAfterMs: number }
  | { readonly kind: "timeout" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * One provider, one call. This port deliberately has no fallback: routing decides which provider is
 * next, so that every attempt is preceded by a routing decision, a log entry and an idempotency
 * claim. A provider SDK belongs behind this port as an adapter, never in front of it.
 */
export interface ModelProvider {
  readonly id: ProviderId;
  complete(request: CompletionRequest): Promise<Result<CompletionResponse, ProviderFailure>>;
}
