import {
  type CompletionUsage,
  type ContentHasher,
  err,
  ok,
  type Principal,
  type ProviderId,
  type Region,
  type Result,
  type RunId,
  type SubjectId,
} from "@custodian/primitives";
import type { PromptSnapshot } from "@custodian/governance";
import { namespaceFor, type VerifiedTenantClaim } from "@custodian/knowledge";
import type { SubjectKeyStore } from "@custodian/custody";
import { appendEntry, type LoggedEntry } from "@custodian/evidence";
import type { IdempotencyStore, RecordedOutcome } from "../domain/idempotency-store";
import type { RequestHash } from "../domain/request-hash";
import { bucketFor } from "@custodian/primitives";
import { type ProviderProfile } from "../domain/provider-profile";
import { selectProvider } from "../domain/select-provider";
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
  /**
   * The verified claim, not a tenant id. Both the logged tenant and the namespace every store is
   * scoped by are derived from it, so neither can be asserted by a caller — the log records a
   * tenant that was proven rather than one that was passed in.
   */
  readonly claim: VerifiedTenantClaim;
  readonly tenantRegion: Region;
  readonly legalBasisPolicy: string;
  readonly requiresZeroRetention: boolean;
  /**
   * The registry supplies the prompt text *and* the pinned model, rather than the caller supplying
   * either. That is what makes `model-invoked` recordable: a completion whose prompt version cannot
   * be named is a completion no rollback can reason about.
   */
  readonly prompt: PromptSnapshot;
  /**
   * The triggering request, which is what field group 1 requires the log to seal
   * (Compliance_and_Certification.txt:51). Sealing `prompt.text` instead would record the template
   * — byte-identical for every run on that version, and already named by `promptVersion`.
   */
  readonly input: string;
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
  /** Cost stays a pure function of usage and the price table — see @custodian/evidence. */
  readonly costMicros: (usage: CompletionUsage) => number;
};

export type ServedCompletion = {
  readonly response: CompletionResponse;
  readonly log: readonly LoggedEntry[];
};

export type ServeRejection =
  | { readonly kind: "refused"; readonly reason: string }
  /** A redelivery of a request that already reached an outcome — the first outcome stands. */
  | { readonly kind: "already-served"; readonly outcome: RecordedOutcome }
  /**
   * A redelivery of a request still in flight. Distinct from `already-served` because there is no
   * outcome to return: the caller must retry, not treat this as an answer. `executeOnce` already
   * draws this line, and a second, weaker copy of it here would be two implementations of one rule.
   */
  | { readonly kind: "in-flight" }
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
  | {
      readonly kind: "served";
      readonly response: CompletionResponse;
      /** seq of this attempt's model-invoked entry, recorded into usage-recorded at close. */
      readonly invocationSeq: number;
    }
  | { readonly kind: "retryable" }
  | { readonly kind: "halted"; readonly rejection: ServeRejection };

type AttemptState = {
  readonly attempted: ProviderId[];
  log: readonly LoggedEntry[];
};

function completionRequestFor(serve: ServeRequest): CompletionRequest {
  return {
    model: serve.prompt.model,
    system: serve.prompt.text,
    input: serve.input,
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
  const invocationSeq = appended.value.length - 1;

  const provider = serve.providers.find((candidate) => candidate.id === decision.provider);
  if (provider === undefined) {
    const reason = "no-adapter-for-provider";
    return { kind: "halted", rejection: { kind: "provider-failed", reason } };
  }

  state.attempted.push(decision.provider);
  const completed = await provider.complete(completionRequestFor(serve));
  if (completed.ok) {
    return { kind: "served", response: completed.value, invocationSeq };
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
  // Field group 1 is per run, not per provider call. The agent runtime calls serveCompletion once
  // per loop turn; re-opening on every turn would write a second attribution record the
  // accounting unit does not have (Compliance_and_Certification.txt:50 — "per agent session").
  if (serve.log.some((entry) => entry.event.kind === "run-started")) {
    return ok(serve.log);
  }
  const sealed = await serve.keys.seal({
    subject: serve.subject,
    bucket: bucketFor("execution-log-content", serve.at),
    plaintext: serve.input,
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
      tenant: serve.claim.tenant,
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
 * A terminal failure completes the claim rather than leaving it open. A claim abandoned at
 * `outcome: undefined` blocks every redelivery for its full 24-hour TTL
 * (@custodian/serving `CLAIM_TTL_MS`), so a run refused on residency grounds would answer
 * `in-flight` for a day to a caller that can never succeed.
 */
async function failRun(
  serve: ServeRequest,
  state: AttemptState,
  rejection: ServeRejection,
): Promise<Result<ServedCompletion, ServeFailure>> {
  const sealed = await serve.keys.seal({
    subject: serve.subject,
    bucket: bucketFor("prompts-and-completions", serve.at),
    plaintext: JSON.stringify(rejection),
  });
  if (sealed.ok) {
    await serve.idempotency.complete(namespaceFor(serve.claim), serve.requestHash, {
      status: "failed",
      body: sealed.value,
    });
  }
  return err({ rejection, log: state.log });
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
  invocationSeq: number,
): Promise<Result<ServedCompletion, ServeFailure>> {
  const sealed = await serve.keys.seal({
    subject: serve.subject,
    bucket: bucketFor("prompts-and-completions", serve.at),
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
      invocationSeq,
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

  await serve.idempotency.complete(namespaceFor(serve.claim), serve.requestHash, {
    status: "succeeded",
    body: sealed.value,
  });
  return ok({ response, log: recorded.value });
}

export async function serveCompletion(
  serve: ServeRequest,
): Promise<Result<ServedCompletion, ServeFailure>> {
  const claimed = await serve.idempotency.claim(
    namespaceFor(serve.claim),
    serve.requestHash,
    serve.at,
  );
  if (!claimed.ok) {
    const rejection = { kind: "provider-failed", reason: claimed.error.kind } as const;
    return err({ rejection, log: serve.log });
  }
  if (claimed.value.kind === "already-claimed") {
    const recorded = claimed.value.claim.outcome;
    const rejection: ServeRejection =
      recorded === undefined
        ? { kind: "in-flight" }
        : { kind: "already-served", outcome: recorded };
    return err({ rejection, log: serve.log });
  }

  const opened = await openRun(serve);
  if (!opened.ok) {
    return err(opened.error);
  }

  const state: AttemptState = { attempted: [], log: opened.value };

  for (let attempt = 1; attempt <= DEFAULT_RETRY_POLICY.maxAttempts; attempt += 1) {
    const outcome = await attemptOnce(serve, state, attempt);
    if (outcome.kind === "halted") {
      return failRun(serve, state, outcome.rejection);
    }
    if (outcome.kind === "served") {
      return closeRun(serve, state, outcome.response, outcome.invocationSeq);
    }
  }

  return failRun(serve, state, { kind: "provider-failed", reason: "attempts-exhausted" });
}
