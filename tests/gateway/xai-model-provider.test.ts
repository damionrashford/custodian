import { expect, test } from "bun:test";
import { parseModelSnapshot, parseProviderId } from "@custodian/domain-primitives";
import { buildXaiRequest, parseXaiResponse, type XaiProviderConfig } from "@custodian/gateway";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const pinnedModel = must(parseModelSnapshot("grok-4.6-20260801"), "model");

const config: XaiProviderConfig = {
  // A stub scheme, not the real endpoint: these tests never reach the network, and writing the
  // live URL here — even split to dodge the guard — is the shape LD-10's rule exists to keep out.
  baseUrl: "stub://provider/v1",
  id: must(parseProviderId("xai-us"), "provider"),
  apiKey: "test-key",
  modelIds: new Map([[pinnedModel, "grok-4.6"]]),
  reasoningEffort: "low",
  timeoutMs: 30_000,
};

const request = {
  model: pinnedModel,
  system: "You answer questions.",
  input: "What is Custodian?",
  maxOutputTokens: 400,
};

test("the request carries auth, both messages, the cap, and reasoning_effort", () => {
  const built = buildXaiRequest(request, config);
  if (!built.ok) throw new Error("build refused");
  expect(built.value.url.endsWith("/chat/completions")).toBe(true);
  expect(built.value.headers["authorization"]).toBe("Bearer test-key");
  const body = JSON.parse(built.value.body) as Record<string, unknown>;
  // The wire carries the provider id, never the platform pin.
  expect(body["model"]).toBe("grok-4.6");
  expect(body["max_tokens"]).toBe(400);
  expect(body["reasoning_effort"]).toBe("low");
  expect(body["messages"]).toEqual([
    { role: "system", content: "You answer questions." },
    { role: "user", content: "What is Custodian?" },
  ]);
});

test("reasoning_effort is absent from the body when not configured", () => {
  const built = buildXaiRequest(request, { ...config, reasoningEffort: undefined });
  if (!built.ok) throw new Error("build refused");
  expect(JSON.parse(built.value.body)).not.toHaveProperty("reasoning_effort");
});

test("an unmapped snapshot is refused, never sent as-is", () => {
  const built = buildXaiRequest(request, { ...config, modelIds: new Map() });
  expect(built).toEqual({
    ok: false,
    error: { kind: "refused", reason: "model-not-served-by-provider" },
  });
});

test("a well-formed response yields text and token usage", () => {
  const parsed = parseXaiResponse({
    choices: [{ message: { content: "An agent platform." } }],
    usage: { prompt_tokens: 12, completion_tokens: 5 },
  });
  expect(parsed).toEqual({
    ok: true,
    value: { text: "An agent platform.", usage: { inputTokens: 12, outputTokens: 5 } },
  });
});

test("a malformed response is unavailable, and no provider text leaks into the failure", () => {
  const parsed = parseXaiResponse({ error: "Internal: stack at XaiHandler.serve" });
  expect(parsed.ok).toBe(false);
  if (parsed.ok) return;
  expect(parsed.error.kind).toBe("unavailable");
  expect(JSON.stringify(parsed.error)).not.toContain("XaiHandler");
});

test("an empty choices array is unavailable, not a crash", () => {
  const parsed = parseXaiResponse({
    choices: [],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  });
  expect(parsed.ok).toBe(false);
});
