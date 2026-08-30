import { err, ok, type Result, type TenantId } from "@custodian/domain-primitives";
import {
  appendEntry,
  type EntryHasher,
  type LoggedEntry,
  type RunId,
} from "@custodian/execution-log";
import type { IdempotencyStore, RequestHash } from "@custodian/idempotency";
import {
  selectProvider,
  type ProviderId,
  type ProviderProfile,
  type Region,
} from "@custodian/routing";
import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
} from "../domain/model-provider";
import { DEFAULT_RETRY_POLICY, nextRetry } from "../domain/retry-policy";

export type ServeRequest = {
  readonly runId: RunId;
  readonly tenant: TenantId;
  readonly tenantRegion: Region;
  readonly requiresZeroRetention: boolean;
  readonly request: CompletionRequest;
  readonly requestHash: RequestHash;
  readonly candidates: readonly ProviderProfile[];
  readonly providers: readonly ModelProvider[];
  readonly idempotency: IdempotencyStore;
  readonly hasher: EntryHasher;
  readonly at: string;
  readonly jitter: number;
};

export type ServedCompletion = {
  readonly response: CompletionResponse;
  readonly log: readonly LoggedEntry[];
};

export type ServeFailure =
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "already-served" }
  | { readonly kind: "provider-failed"; readonly reason: string };

/**
 * Residency is re-evaluated on every attempt rather than once at the start, because a failover that
 * skips the check is exactly the silent cross-border call the spec forbids
 * (Data_Protection_and_Retention.txt:145-150). The claim is written before any provider call, so
 * dedupe precedes failover rather than racing it.
 */
type AttemptOutcome =
  | { readonly kind: "served"; readonly response: CompletionResponse }
  | { readonly kind: "retryable" }
  | { readonly kind: "halted"; readonly failure: ServeFailure };

type AttemptState = {
  readonly attempted: ProviderId[];
  log: readonly LoggedEntry[];
};

async function attemptOnce(
  serve: ServeRequest,
  state: AttemptState,
  attempt: number,
): Promise<AttemptOutcome> {
  const decision = selectProvider({
    tenantRegion: serve.tenantRegion,
    requiresZeroRetention: serve.requiresZeroRetention,
    candidates: serve.candidates,
    attempted: state.attempted,
  });

  if (decision.kind === "refuse") {
    return { kind: "halted", failure: { kind: "refused", reason: decision.reason } };
  }

  const appended = appendEntry(
    state.log,
    {
      kind: "model-invoked",
      model: serve.request.model,
      snapshot: serve.request.model,
      promptVersion: "unversioned",
      routerDecision: decision.provider,
      routerRationale: decision.rationale,
    },
    { runId: serve.runId, at: serve.at, hasher: serve.hasher },
  );
  if (!appended.ok) {
    return { kind: "halted", failure: { kind: "provider-failed", reason: appended.error.kind } };
  }
  state.log = appended.value;

  const provider = serve.providers.find((candidate) => candidate.id === decision.provider);
  if (provider === undefined) {
    const failure: ServeFailure = { kind: "provider-failed", reason: "no-adapter-for-provider" };
    return { kind: "halted", failure };
  }

  state.attempted.push(decision.provider);
  const completed = await provider.complete(serve.request);
  if (completed.ok) {
    return { kind: "served", response: completed.value };
  }

  const retry = nextRetry(completed.error, {
    attempt,
    policy: DEFAULT_RETRY_POLICY,
    jitter: serve.jitter,
  });
  return retry.kind === "give-up"
    ? { kind: "halted", failure: { kind: "provider-failed", reason: retry.reason } }
    : { kind: "retryable" };
}

export async function serveCompletion(
  serve: ServeRequest,
): Promise<Result<ServedCompletion, ServeFailure>> {
  const claimed = await serve.idempotency.claim(serve.requestHash, serve.at);
  if (!claimed.ok || claimed.value.kind === "already-claimed") {
    return err({ kind: "already-served" });
  }

  const state: AttemptState = { attempted: [], log: [] };

  for (let attempt = 1; attempt <= DEFAULT_RETRY_POLICY.maxAttempts; attempt += 1) {
    const outcome = await attemptOnce(serve, state, attempt);
    if (outcome.kind === "halted") {
      return err(outcome.failure);
    }
    if (outcome.kind === "served") {
      await serve.idempotency.complete(serve.requestHash, {
        status: "succeeded",
        body: outcome.response.text,
      });
      return ok({ response: outcome.response, log: state.log });
    }
  }

  return err({ kind: "provider-failed", reason: "attempts-exhausted" });
}
