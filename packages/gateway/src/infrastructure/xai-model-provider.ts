import { err, ok, type ProviderId, type Result } from "@custodian/domain-primitives";
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
  /** Works on grok-4.6 despite the docs scoping it to 4.3, and roughly halves cost. */
  readonly reasoningEffort: "low" | "high" | undefined;
};

export type BuiltRequest = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};

export function buildXaiRequest(
  request: CompletionRequest,
  config: XaiProviderConfig,
): BuiltRequest {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.input },
    ],
    max_tokens: request.maxOutputTokens,
  };
  if (config.reasoningEffort !== undefined) {
    body["reasoning_effort"] = config.reasoningEffort;
  }
  return {
    url: `${config.baseUrl}/chat/completions`,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  async complete(
    request: CompletionRequest,
  ): Promise<Result<CompletionResponse, ProviderFailure>> {
    const built = buildXaiRequest(request, this.#config);
    let response: Response;
    try {
      response = await fetch(built.url, {
        method: "POST",
        headers: built.headers,
        body: built.body,
      });
    } catch {
      return err({ kind: "unavailable" });
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
