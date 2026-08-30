import { dns } from "bun";
import { err, isRecord, ok, type Result, type ToolName } from "@custodian/primitives";
import { permitUrl, type EgressPolicy, type UrlRejection } from "../domain/url-policy";
import type { Tool, ToolFailure, ToolObservation } from "../domain/tool";

/** Enough for a page, small enough that one fetch cannot fill the model's context. */
const MAX_BODY_BYTES = 128 * 1024;
const TIMEOUT_MS = 10_000;
/** A permitted host may redirect; each hop is re-checked, and the chain is not unbounded. */
const MAX_REDIRECTS = 3;

export type WebFetchOptions = {
  readonly name: ToolName;
  readonly policy: EgressPolicy;
};

/**
 * Fetches a URL for the agent.
 *
 * `sensitive-data-access`, because a fetch is also an exfiltration channel: whatever the model puts
 * in a path or query string leaves the building. The allowlist is what bounds that, which is why it
 * is deny-by-default rather than a filter on obviously-bad hosts.
 *
 * Redirects are followed manually. A host on the allowlist can answer 302 and point anywhere,
 * including at the instance metadata endpoint, so `redirect: "manual"` and a re-check per hop is
 * the only version of this that holds — `redirect: "follow"` would let the allowlist be bypassed by
 * any allowlisted host, including a compromised one.
 */
export class WebFetchTool implements Tool {
  readonly name: ToolName;
  readonly actionClass = "sensitive-data-access" as const;
  readonly #policy: EgressPolicy;

  constructor(options: WebFetchOptions) {
    this.name = options.name;
    this.#policy = options.policy;
  }

  async execute(argumentsJson: string): Promise<Result<ToolObservation, ToolFailure>> {
    const parsed = parseUrl(argumentsJson);
    if (!parsed.ok) {
      return err(parsed.error);
    }

    let target = parsed.value.url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const checked = await this.#permit(target);
      if (!checked.ok) {
        return err(checked.error);
      }

      let response: Response;
      try {
        response = await fetch(checked.value, {
          // Manual, so the next hop goes back through the policy above rather than around it.
          redirect: "manual",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { accept: "text/*, application/json" },
        });
      } catch (cause) {
        return err({ kind: "execution-failed", reason: `request failed: ${String(cause)}` });
      }

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location !== null) {
        target = new URL(location, checked.value).toString();
        continue;
      }

      const body = await readBounded(response);
      return ok({
        kind: "acted",
        receipt: {
          summary: `${String(response.status)} from ${new URL(checked.value).hostname}${
            body.truncated ? `, first ${String(MAX_BODY_BYTES)} bytes` : ""
          }`,
          // Content someone else wrote, which is the definition of the indirect-injection channel
          // (AI_Agent_Implementation_Plan_v2.txt:229). The runtime rails it before the model sees it.
          output: body.text,
        },
      });
    }

    return err({ kind: "execution-failed", reason: "too many redirects" });
  }

  /**
   * Resolves the host first, then decides. Checking the hostname alone would pass any name whose
   * owner points it at a private address, which is the ordinary shape of an SSRF.
   */
  async #permit(target: string): Promise<Result<string, ToolFailure>> {
    let hostname: string;
    try {
      hostname = new URL(target).hostname;
    } catch {
      return err({ kind: "invalid-arguments", reason: "url-unparseable" });
    }

    let address: string;
    try {
      const [resolved] = await dns.lookup(hostname);
      if (resolved === undefined) {
        return err({ kind: "execution-failed", reason: "host did not resolve" });
      }
      address = resolved.address;
    } catch {
      return err({ kind: "execution-failed", reason: "host did not resolve" });
    }

    const permitted = permitUrl(target, address, this.#policy);
    return permitted.ok ? ok(String(permitted.value)) : err(refused(permitted.error));
  }
}

/**
 * The rejection kind is returned as-is. It names a policy decision rather than anything about the
 * target's internals, so it is safe for a model to see and useful for it to know — "that host is
 * not on the allowlist" stops it retrying, where a generic failure would not.
 */
function refused(rejection: UrlRejection): ToolFailure {
  return { kind: "invalid-arguments", reason: rejection.kind };
}

async function readBounded(
  response: Response,
): Promise<{ readonly text: string; readonly truncated: boolean }> {
  const stream = response.body;
  if (stream === null) {
    return { text: "", truncated: false };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for await (const chunk of stream) {
    // Response.body is loosely typed, so the bytes are narrowed here rather than asserted. This is
    // a boundary like any other: what arrives is checked once, and everything downstream is typed.
    if (!(chunk instanceof Uint8Array)) {
      continue;
    }
    if (total + chunk.byteLength > MAX_BODY_BYTES) {
      truncated = true;
      break;
    }
    chunks.push(chunk);
    total += chunk.byteLength;
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(joined), truncated };
}

function parseUrl(argumentsJson: string): Result<{ readonly url: string }, ToolFailure> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson);
  } catch {
    return err({ kind: "invalid-arguments", reason: "arguments were not JSON" });
  }
  if (!isRecord(parsed)) {
    return err({ kind: "invalid-arguments", reason: "arguments were not an object" });
  }
  const url = parsed["url"];
  return typeof url === "string"
    ? ok({ url })
    : err({ kind: "invalid-arguments", reason: "url must be a string" });
}
