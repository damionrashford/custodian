import {
  err,
  isRecord,
  ok,
  type ModelSnapshot,
  type ProviderId,
  type Result,
} from "@custodian/domain-primitives";
import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
  ProviderFailure,
} from "../domain/model-provider";

export type XaiProviderConfig = {
  readonly id: ProviderId;
  readonly baseUrl: string;
  readonly apiKey: string;
  /**
   * Platform snapshots are pinned (grok-4.6-20260801); xAI serves undated ids (grok-4.6). The
   * adapter owns that translation, so the log records the pin while the wire carries the id the
   * provider actually understands. An unmapped snapshot is refused, never sent as-is.
   */
  readonly modelIds: ReadonlyMap<ModelSnapshot, string>;
  /** Works on grok-4.6 despite the docs scoping it to 4.3, and roughly halves cost. */
  readonly reasoningEffort: "low" | "high" | undefined;
  /**
   * Without a deadline a stalled provider hangs the whole run: the loop's iteration, cost and
   * stagnation ceilings are only evaluated between turns, so a turn that never returns is a run
   * that never halts. A deadline turns that into a `timeout`, which the retry policy treats as
   * transient and the fallback chain can act on.
   */
  readonly timeoutMs: number;
};

export type BuiltRequest = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};

export function buildXaiRequest(
  request: CompletionRequest,
  config: XaiProviderConfig,
): Result<BuiltRequest, ProviderFailure> {
  const modelId = config.modelIds.get(request.model);
  if (modelId === undefined) {
    return err({ kind: "refused", reason: "model-not-served-by-provider" });
  }
  const body: Record<string, unknown> = {
    model: modelId,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.input },
    ],
    max_tokens: request.maxOutputTokens,
  };
  if (config.reasoningEffort !== undefined) {
    body["reasoning_effort"] = config.reasoningEffort;
  }
  return ok({
    url: `${config.baseUrl}/chat/completions`,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Malformed maps to `unavailable` (retryable — a healthy replica may answer), and the raw payload
 * never rides along: provider text propagating past the adapter is the information-disclosure
 * path the interface vocabulary rules exist to close.
 */
export function parseXaiResponse(payload: unknown): Result<CompletionResponse, ProviderFailure> {
  if (!isRecord(payload)) {
    return err({ kind: "unavailable" });
  }
  const choices = payload["choices"];
  const usage = payload["usage"];
  if (!Array.isArray(choices) || !isRecord(usage)) {
    return err({ kind: "unavailable" });
  }
  const first: unknown = choices[0];
  if (!isRecord(first) || !isRecord(first["message"])) {
    return err({ kind: "unavailable" });
  }
  const text = first["message"]["content"];
  const inputTokens = usage["prompt_tokens"];
  const outputTokens = usage["completion_tokens"];
  if (
    typeof text !== "string" ||
    typeof inputTokens !== "number" ||
    typeof outputTokens !== "number"
  ) {
    return err({ kind: "unavailable" });
  }
  return ok({ text, usage: { inputTokens, outputTokens } });
}

export class XaiModelProvider implements ModelProvider {
  readonly id: ProviderId;
  readonly #config: XaiProviderConfig;

  constructor(config: XaiProviderConfig) {
    this.id = config.id;
    this.#config = config;
  }

  async complete(request: CompletionRequest): Promise<Result<CompletionResponse, ProviderFailure>> {
    const built = buildXaiRequest(request, this.#config);
    if (!built.ok) {
      return built;
    }
    let response: Response;
    try {
      response = await fetch(built.value.url, {
        method: "POST",
        headers: built.value.headers,
        body: built.value.body,
        signal: AbortSignal.timeout(this.#config.timeoutMs),
      });
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
      return err(timedOut ? { kind: "timeout" } : { kind: "unavailable" });
    }
    if (response.status === 429) {
      const after = Number(response.headers.get("retry-after") ?? "1");
      return err({
        kind: "rate-limited",
        retryAfterMs: Number.isFinite(after) ? after * 1000 : 1000,
      });
    }
    if (response.status >= 500) {
      return err({ kind: "unavailable" });
    }
    if (response.status >= 400) {
      return err({ kind: "refused", reason: "provider-rejected-request" });
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return err({ kind: "unavailable" });
    }
    return parseXaiResponse(payload);
  }
}
