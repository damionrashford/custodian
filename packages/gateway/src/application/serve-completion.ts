import {
  type CompletionUsage,
  type ContentHasher,
  err,
  ok,
  type Principal,
  type ProviderId,
  type Region,
  type Result,
  type RetentionBucket,
  type RunId,
  type SubjectId,
  type TenantId,
} from "@custodian/domain-primitives";
import type { PromptSnapshot } from "@custodian/config-registry";
import type { SubjectKeyStore } from "@custodian/crypto-shred";
import { appendEntry, type LoggedEntry } from "@custodian/execution-log";
import type { IdempotencyStore, RequestHash } from "@custodian/idempotency";
import { selectProvider, type ProviderProfile } from "@custodian/routing";
import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
} from "../domain/model-provider";
import { DEFAULT_RETRY_POLICY, nextRetry } from "../domain/retry-policy";

export type ServeRequest = {
  readonly runId: RunId;
  /** Field group 1 of the execution log: who triggered this, under which tenant policy. */
  readonly principal: Principal;
  readonly tenant: TenantId;
  readonly tenantRegion: Region;
  readonly legalBasisPolicy: string;
  readonly requiresZeroRetention: boolean;
  /**
   * The registry supplies the prompt text *and* the pinned model, rather than the caller supplying
   * either. That is what makes `model-invoked` recordable: a completion whose prompt version cannot
   * be named is a completion no rollback can reason about.
   */
  readonly prompt: PromptSnapshot;
  readonly maxOutputTokens: number;
  /**
   * The run's log so far. Entries chain by hash from the previous one, so a gateway that started
   * its own chain at seq 0 would produce a second entry numbered 0 for the same run — which
   * `verifyRunLog` reports as a sequence gap the moment the two are put together.
   */
  readonly log: readonly LoggedEntry[];
  readonly requestHash: RequestHash;
  readonly candidates: readonly ProviderProfile[];
  readonly providers: readonly ModelProvider[];
  readonly idempotency: IdempotencyStore;
  readonly hasher: ContentHasher;
  readonly at: string;
  readonly jitter: number;
  /** The completion is personal data, so it is sealed before it reaches the idempotency store. */
  readonly keys: SubjectKeyStore;
  readonly subject: SubjectId;
  readonly bucket: RetentionBucket;
  /** Cost stays a pure function of usage and the price table — see @custodian/metering. */
  readonly costMicros: (usage: CompletionUsage) => number;
};

export type ServedCompletion = {
  readonly response: CompletionResponse;
  readonly log: readonly LoggedEntry[];
};

export type ServeRejection =
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "already-served" }
  | { readonly kind: "provider-failed"; readonly reason: string };

/**
 * A failure carries the run's log, not just the reason. A residency refusal is the single event
 * most in need of evidence — it is the one the fallback chain exists to produce
 * (Data_Protection_and_Retention.txt:145-150) — and returning only an error would leave the run
 * that was refused indistinguishable in the record from one that never started.
 */
export type ServeFailure = {
  readonly rejection: ServeRejection;
  readonly log: readonly LoggedEntry[];
};

/**
 * Residency is re-evaluated on every attempt rather than once at the start, because a failover that
 * skips the check is exactly the silent cross-border call the spec forbids
 * (Data_Protection_and_Retention.txt:145-150). The claim is written before any provider call, so
 * dedupe precedes failover rather than racing it.
 */
type AttemptOutcome =
  | { readonly kind: "served"; readonly response: CompletionResponse }
  | { readonly kind: "retryable" }
  | { readonly kind: "halted"; readonly rejection: ServeRejection };

type AttemptState = {
  readonly attempted: ProviderId[];
  log: readonly LoggedEntry[];
};

function completionRequestFor(serve: ServeRequest): CompletionRequest {
  return {
    model: serve.prompt.model,
    prompt: serve.prompt.text,
    maxOutputTokens: serve.maxOutputTokens,
  };
}

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
    return { kind: "halted", rejection: { kind: "refused", reason: decision.reason } };
  }

  const appended = appendEntry(
    state.log,
    {
      kind: "model-invoked",
      snapshot: serve.prompt.model,
      promptVersion: serve.prompt.version,
      routerDecision: decision.provider,
      routerRationale: decision.rationale,
    },
    { runId: serve.runId, at: serve.at, hasher: serve.hasher },
  );
  if (!appended.ok) {
    return { kind: "halted", rejection: { kind: "provider-failed", reason: appended.error.kind } };
  }
  state.log = appended.value;

  const provider = serve.providers.find((candidate) => candidate.id === decision.provider);
  if (provider === undefined) {
    const reason = "no-adapter-for-provider";
    return { kind: "halted", rejection: { kind: "provider-failed", reason } };
  }

  state.attempted.push(decision.provider);
  const completed = await provider.complete(completionRequestFor(serve));
  if (completed.ok) {
    return { kind: "served", response: completed.value };
  }

  const retry = nextRetry(completed.error, {
    attempt,
    policy: DEFAULT_RETRY_POLICY,
    jitter: serve.jitter,
  });
  return retry.kind === "give-up"
    ? { kind: "halted", rejection: { kind: "provider-failed", reason: retry.reason } }
    : { kind: "retryable" };
}

/**
 * Field group 1, written before the first provider call so that a run failing on every attempt
 * still has an entry naming the principal, tenant, region and legal basis it was refused under
 * (Compliance_and_Certification.txt:51). A failed run with no such entry is unattributable.
 */
async function openRun(serve: ServeRequest): Promise<Result<readonly LoggedEntry[], ServeFailure>> {
  const sealed = await serve.keys.seal({
    subject: serve.subject,
    bucket: serve.bucket,
    plaintext: serve.prompt.text,
  });
  if (!sealed.ok) {
    const rejection = { kind: "provider-failed", reason: "seal-failed" } as const;
    return err({ rejection, log: serve.log });
  }

  const started = appendEntry(
    serve.log,
    {
      kind: "run-started",
      principal: serve.principal,
      tenant: serve.tenant,
      region: serve.tenantRegion,
      legalBasisPolicy: serve.legalBasisPolicy,
      request: sealed.value,
    },
    { runId: serve.runId, at: serve.at, hasher: serve.hasher },
  );
  return started.ok
    ? ok(started.value)
    : err({
        rejection: { kind: "provider-failed", reason: started.error.kind },
        log: serve.log,
      });
}

/**
 * Field group 8: token counts and cost, reconcilable to the billing ledger
 * (Compliance_and_Certification.txt:58). Without this entry the log has no usage record for a call
 * the provider did bill, so reconcile() can never close cleanly on gateway traffic.
 */
async function closeRun(
  serve: ServeRequest,
  state: AttemptState,
  response: CompletionResponse,
): Promise<Result<ServedCompletion, ServeFailure>> {
  const sealed = await serve.keys.seal({
    subject: serve.subject,
    bucket: serve.bucket,
    plaintext: response.text,
  });
  if (!sealed.ok) {
    const rejection = { kind: "provider-failed", reason: "seal-failed" } as const;
    return err({ rejection, log: state.log });
  }

  const recorded = appendEntry(
    state.log,
    {
      kind: "usage-recorded",
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costMicros: serve.costMicros(response.usage),
    },
    { runId: serve.runId, at: serve.at, hasher: serve.hasher },
  );
  if (!recorded.ok) {
    const rejection = { kind: "provider-failed", reason: recorded.error.kind } as const;
    return err({ rejection, log: state.log });
  }

  await serve.idempotency.complete(serve.requestHash, { status: "succeeded", body: sealed.value });
  return ok({ response, log: recorded.value });
}

export async function serveCompletion(
  serve: ServeRequest,
): Promise<Result<ServedCompletion, ServeFailure>> {
  const claimed = await serve.idempotency.claim(serve.requestHash, serve.at);
  if (!claimed.ok || claimed.value.kind === "already-claimed") {
    return err({ rejection: { kind: "already-served" }, log: serve.log });
  }

  const opened = await openRun(serve);
  if (!opened.ok) {
    return err(opened.error);
  }

  const state: AttemptState = { attempted: [], log: opened.value };

  for (let attempt = 1; attempt <= DEFAULT_RETRY_POLICY.maxAttempts; attempt += 1) {
    const outcome = await attemptOnce(serve, state, attempt);
    if (outcome.kind === "halted") {
      return err({ rejection: outcome.rejection, log: state.log });
    }
    if (outcome.kind === "served") {
      return closeRun(serve, state, outcome.response);
    }
  }

  const rejection = { kind: "provider-failed", reason: "attempts-exhausted" } as const;
  return err({ rejection, log: state.log });
}
