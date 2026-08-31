import { expect, test } from "bun:test";
import {
  parseModelSnapshot,
  parsePrincipalId,
  parseProviderId,
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
import { serveCompletion, type CompletionResponse, type ModelProvider } from "@custodian/serving";
import { InMemoryIdempotencyStore, parseRequestHash } from "@custodian/serving";
import { Sha256ContentHasher, verifyRunLog } from "@custodian/evidence";
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
const euWest = parsedOrThrow(parseRegion("eu-west-1"), "region");
const subject = parsedOrThrow(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject");

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
  changeSource: "ticket CUS-119",
  rationale: "run-started-once fixture",
  evalPassCaret: 0.9,
  createdAt: "2026-08-29T00:00:00.000Z",
};

function profile(id: string): ProviderProfile {
  return {
    id: parsedOrThrow(parseProviderId(id), "provider id"),
    processingRegion: euWest,
    storageRegion: euWest,
    zeroRetention: true,
    healthy: true,
  };
}

function succeeds(id: string): ModelProvider {
  const response: CompletionResponse = {
    text: "done",
    usage: { inputTokens: 10, outputTokens: 5 },
  };
  return {
    id: parsedOrThrow(parseProviderId(id), "provider id"),
    complete: () => Promise.resolve({ ok: true as const, value: response }),
  };
}

function baseRequest(hash: string) {
  return {
    runId,
    principal: operator,
    claim: tenantClaim(),
    tenantRegion: euWest,
    legalBasisPolicy: "tenant-contract",
    requiresZeroRetention: true,
    prompt,
    input: "turn input",
    maxOutputTokens: 100,
    log: [],
    requestHash: parsedOrThrow(parseRequestHash(hash), "hash"),
    candidates: [profile("eu-primary")],
    providers: [succeeds("eu-primary")],
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

test("a second turn continues the run without opening it again", async () => {
  const first = await serveCompletion(baseRequest("b".repeat(64)));
  if (!first.ok) throw new Error("turn 1 failed");

  const second = await serveCompletion({
    ...baseRequest("c".repeat(64)),
    log: first.value.log,
  });
  if (!second.ok) throw new Error("turn 2 failed");

  // Field group 1 is per run, not per provider call (compliance-and-certification.txt:50): a
  // multi-turn loop threading the log through serveCompletion must not re-attribute the run.
  const opened = second.value.log.filter((entry) => entry.event.kind === "run-started");
  expect(opened).toHaveLength(1);
  expect(verifyRunLog(second.value.log, hasher).ok).toBe(true);
});
