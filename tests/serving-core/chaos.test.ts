import { expect, test } from "bun:test";
import { parseRetentionBucket, parseSubjectId, parseTenantId } from "@custodian/domain-primitives";
import { AesGcmSubjectKeyStore } from "@custodian/crypto-shred";
import {
  parseModelSnapshot,
  serveCompletion,
  type CompletionResponse,
  type ModelProvider,
  type ProviderFailure,
} from "@custodian/gateway";
import { InMemoryIdempotencyStore, parseRequestHash } from "@custodian/idempotency";
import { parseRunId, Sha256EntryHasher } from "@custodian/execution-log";
import { parseProviderId, parseRegion, type ProviderProfile } from "@custodian/routing";

function parsedOrThrow<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const hasher = new Sha256EntryHasher();
const model = parsedOrThrow(parseModelSnapshot("frontier-1.5-20260801"), "model");
const tenant = parsedOrThrow(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
const runId = parsedOrThrow(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");
const requestHash = parsedOrThrow(parseRequestHash("b".repeat(64)), "hash");
const euWest = parsedOrThrow(parseRegion("eu-west-1"), "region");
const subject = parsedOrThrow(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject");
const bucket = parsedOrThrow(parseRetentionBucket("content-2026-08"), "bucket");
const usEast = parsedOrThrow(parseRegion("us-east-1"), "region");

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
    tenant,
    tenantRegion: euWest,
    requiresZeroRetention: true,
    request: { model, prompt: "hello", maxOutputTokens: 100 },
    requestHash,
    candidates,
    providers,
    idempotency: new InMemoryIdempotencyStore({ onWrite: () => undefined }),
    hasher,
    at: "2026-08-29T00:00:00.000Z",
    jitter: 0,
    keys: new AesGcmSubjectKeyStore({ now: () => new Date("2026-08-29T00:00:00.000Z") }),
    subject,
    bucket,
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

  expect(served).toEqual({
    ok: false,
    error: { kind: "refused", reason: "all-eligible-exhausted" },
  });
  expect(calls).toEqual([]);
});

test("a redelivered request hash does not produce a second provider call", async () => {
  const calls: string[] = [];
  const request = baseRequest([succeeds("eu-primary", calls)], [profile("eu-primary")]);

  await serveCompletion(request);
  await serveCompletion(request);

  expect(calls).toEqual(["eu-primary"]);
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
