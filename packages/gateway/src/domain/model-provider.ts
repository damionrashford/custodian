import type { CompletionUsage, ModelSnapshot, Result } from "@custodian/domain-primitives";
import type { ProviderId } from "@custodian/domain-primitives";

export type CompletionRequest = {
  readonly model: ModelSnapshot;
  /** The versioned prompt text from the registry. Identical for every run on that version. */
  readonly system: string;
  /** What the caller actually asked. This is the personal data; `system` is not. */
  readonly input: string;
  readonly maxOutputTokens: number;
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
