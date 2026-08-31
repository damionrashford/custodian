import { expect, test } from "bun:test";
import {
  parseModelSnapshot,
  parseProviderId,
  parsePrincipalId,
  parsePromptVersion,
  parseRegion,
  parseRunId,
  parseSubjectId,
  parseTenantId,
  type Principal,
} from "@custodian/primitives";
import {
  EnvelopeSubjectKeyStore,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
} from "@custodian/custody";
import {
  serveCompletion,
  type CompletionResponse,
  type ModelProvider,
  type ProviderFailure,
} from "@custodian/serving";
import { InMemoryIdempotencyStore, parseRequestHash } from "@custodian/serving";
import { appendEntry, Sha256ContentHasher, verifyRunLog } from "@custodian/evidence";
import { type ProviderProfile } from "@custodian/serving";
import type { PromptSnapshot } from "@custodian/governance";
import {
  verifyTenantClaim,
  type ClaimVerifier,
  type VerifiedTenantClaim,
} from "@custodian/knowledge";

function parsedOrThrow<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const hasher = new Sha256ContentHasher();
const model = parsedOrThrow(parseModelSnapshot("frontier-1.5-20260801"), "model");
const tenant = parsedOrThrow(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
const runId = parsedOrThrow(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");
const requestHash = parsedOrThrow(parseRequestHash("b".repeat(64)), "hash");
const euWest = parsedOrThrow(parseRegion("eu-west-1"), "region");
const subject = parsedOrThrow(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject");
const usEast = parsedOrThrow(parseRegion("us-east-1"), "region");

const claimVerifier: ClaimVerifier = {
  verify: () => ({
    ok: true,
    value: {
      tenant,
      issuedAt: "2026-08-28T23:45:00.000Z",
      expiresAt: "2026-08-29T00:15:00.000Z",
    },
  }),
};

function tenantClaim(): VerifiedTenantClaim {
  const verified = verifyTenantClaim("signed", {
    verifier: claimVerifier,
    now: new Date("2026-08-29T00:00:00.000Z"),
  });
  if (!verified.ok) throw new Error("fixture: claim rejected");
  return verified.value;
}

const operator: Principal = {
  kind: "human",
  id: parsedOrThrow(parsePrincipalId("p_operator"), "principal"),
  tenant,
};

const prompt: PromptSnapshot = {
  version: parsedOrThrow(parsePromptVersion("pv_01jd7k9h2m4n6p8r0s2t4v6x8z"), "prompt version"),
  text: "hello",
  model,
  parameters: { temperature: 0.2 },
  changeSource: "ticket CUS-118",
  rationale: "chaos fixture",
  evalPassCaret: 0.9,
  createdAt: "2026-08-29T00:00:00.000Z",
};

function profile(id: string, region = euWest): ProviderProfile {
  return {
    id: parsedOrThrow(parseProviderId(id), "provider id"),
    processingRegion: region,
    storageRegion: region,
    zeroRetention: true,
    healthy: true,
  };
}

function alwaysFails(id: string, failure: ProviderFailure): ModelProvider {
  return {
    id: parsedOrThrow(parseProviderId(id), "provider id"),
    complete: () => Promise.resolve({ ok: false as const, error: failure }),
  };
}

function succeeds(id: string, calls: string[]): ModelProvider {
  const response: CompletionResponse = {
    text: "done",
    usage: { inputTokens: 10, outputTokens: 5 },
  };
  return {
    id: parsedOrThrow(parseProviderId(id), "provider id"),
    complete: () => {
      calls.push(id);
      return Promise.resolve({ ok: true as const, value: response });
    },
  };
}

function baseRequest(providers: readonly ModelProvider[], candidates: readonly ProviderProfile[]) {
  return {
    runId,
    principal: operator,
    claim: tenantClaim(),
    tenantRegion: euWest,
    legalBasisPolicy: "tenant-contract",
    requiresZeroRetention: true,
    prompt,
    input: "what did the user actually type",
    maxOutputTokens: 100,
    log: [],
    requestHash,
    candidates,
    providers,
    idempotency: new InMemoryIdempotencyStore({ onWrite: () => undefined }),
    hasher,
    at: "2026-08-29T00:00:00.000Z",
    jitter: 0,
    keys: new EnvelopeSubjectKeyStore({
      custodian: new InMemoryKeyCustodian({ now: () => new Date("2026-08-29T00:00:00.000Z") }),
      registry: new SqliteDeletionRegistry(":memory:"),
    }),
    subject,
    costMicros: (usage: { inputTokens: number; outputTokens: number }) =>
      usage.inputTokens * 3 + usage.outputTokens * 15,
  };
}

test("a forced failover moves to the next in-region provider and logs both attempts", async () => {
  const calls: string[] = [];
  const served = await serveCompletion(
    baseRequest(
      [alwaysFails("eu-primary", { kind: "unavailable" }), succeeds("eu-secondary", calls)],
      [profile("eu-primary"), profile("eu-secondary")],
    ),
  );

  expect(served.ok).toBe(true);
  if (!served.ok) return;
  expect(calls).toEqual(["eu-secondary"]);

  // Every provider call appears in the log with the router decision that produced it.
  const invocations = served.value.log.filter((entry) => entry.event.kind === "model-invoked");
  expect(invocations).toHaveLength(2);

  // Field group 8: the served call carries a usage record, or reconciliation cannot close.
  const usage = served.value.log.filter((entry) => entry.event.kind === "usage-recorded");
  expect(usage).toHaveLength(1);
  for (const entry of invocations) {
    if (entry.event.kind !== "model-invoked") continue;
    expect(entry.event.routerRationale.length).toBeGreaterThan(0);
  }
});

test("exhausting in-region providers refuses — the out-of-region provider is never called", async () => {
  const calls: string[] = [];
  const served = await serveCompletion(
    baseRequest(
      [
        alwaysFails("eu-primary", { kind: "unavailable" }),
        alwaysFails("eu-secondary", { kind: "unavailable" }),
        succeeds("us-fallback", calls),
      ],
      [profile("eu-primary"), profile("eu-secondary"), profile("us-fallback", usEast)],
    ),
  );

  expect(served.ok).toBe(false);
  if (served.ok) return;
  expect(served.error.rejection).toEqual({ kind: "refused", reason: "all-eligible-exhausted" });
  expect(calls).toEqual([]);
});

test("a redelivered request hash does not produce a second provider call", async () => {
  const calls: string[] = [];
  const request = baseRequest([succeeds("eu-primary", calls)], [profile("eu-primary")]);

  await serveCompletion(request);
  const second = await serveCompletion(request);

  expect(calls).toEqual(["eu-primary"]);
  expect(second.ok).toBe(false);
  if (second.ok) return;
  expect(second.error.rejection.kind).toBe("already-served");
});

test("a non-transient refusal is not retried against a second provider", async () => {
  const calls: string[] = [];
  const served = await serveCompletion(
    baseRequest(
      [
        alwaysFails("eu-primary", { kind: "refused", reason: "content policy" }),
        succeeds("eu-secondary", calls),
      ],
      [profile("eu-primary"), profile("eu-secondary")],
    ),
  );

  expect(served.ok).toBe(false);
  expect(calls).toEqual([]);
});

test("a served call names its principal, tenant, region and legal basis", async () => {
  const served = await serveCompletion(
    baseRequest([succeeds("eu-primary", [])], [profile("eu-primary")]),
  );

  expect(served.ok).toBe(true);
  if (!served.ok) return;
  const first = served.value.log[0];
  if (first?.event.kind !== "run-started") throw new Error("field group 1 missing from the log");

  // A run with no run-started entry is unattributable — there is nothing naming who asked, under
  // which tenant policy, in which region (compliance-and-certification.txt:51).
  expect(first.event.principal).toEqual(operator);
  expect(first.event.region).toBe(euWest);
  expect(first.event.legalBasisPolicy).toBe("tenant-contract");
});

test("a refused run still records who was refused", async () => {
  const served = await serveCompletion(
    baseRequest([succeeds("us-fallback", [])], [profile("us-fallback", usEast)]),
  );

  expect(served.ok).toBe(false);
  if (served.ok) return;
  expect(served.error.rejection).toEqual({
    kind: "refused",
    reason: "no-eligible-in-region-provider",
  });

  // The evidence has to survive the refusal. A run refused on residency grounds that leaves no
  // entry naming the principal is indistinguishable in the record from one that never started.
  const first = served.error.log[0];
  if (first?.event.kind !== "run-started") throw new Error("refusal left no evidence");
  expect(first.event.principal).toEqual(operator);
  expect(first.event.region).toBe(euWest);
});

test("the gateway continues the run's chain rather than starting a second one at seq 0", async () => {
  const opening = appendEntry(
    [],
    {
      kind: "record-retrieved",
      recordId: "kb-1",
      classification: "internal",
      provenance: "tenant-authored",
    },
    { runId, at: "2026-08-29T00:00:00.000Z", hasher },
  );
  if (!opening.ok) throw new Error("fixture: append failed");

  const served = await serveCompletion({
    ...baseRequest([succeeds("eu-primary", [])], [profile("eu-primary")]),
    log: opening.value,
  });
  expect(served.ok).toBe(true);
  if (!served.ok) return;

  // Sequence numbers and previousHash links are computed from the log handed in. Starting from []
  // would emit a second entry at seq 0, which verifyRunLog reports as a sequence gap once the two
  // halves of the run are put together.
  expect(served.value.log.map((entry) => entry.seq)).toEqual([0, 1, 2, 3]);
  expect(verifyRunLog(served.value.log, hasher).ok).toBe(true);
});
