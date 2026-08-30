import { dns } from "bun";
import {
  err,
  isRecord,
  ok,
  type Namespace,
  type Result,
  type ToolName,
} from "@custodian/primitives";
import { egressFor, permitHost, permitUrl, type EgressPolicy } from "../domain/url-policy";
import type { Tool, ToolFailure, ToolObservation } from "../domain/tool";
import { EgressProxy } from "./egress-proxy";

const MAX_DOM_BYTES = 128 * 1024;
const RENDER_TIMEOUT_MS = 30_000;

/**
 * Renders a page in a browser inside the sandbox and returns the DOM it produced.
 *
 * Why this exists alongside the plain web fetch: a fetch returns the bytes the server sent, which
 * for most of the modern web is a loading spinner. Rendering runs the page's own JavaScript, which
 * is also why it is the more dangerous of the two and gets a browser it cannot escape rather than
 * one on the host.
 *
 * `Bun.WebView` is deliberately not used here. It is the right tool for this repo's own scraping,
 * but it runs the page on the host with no egress control, and on macOS its backend is WebKit where
 * `cdp()` throws outright. Handing a model a browser on the host is a different proposition from
 * driving one ourselves.
 *
 * A single shot per call: the container is created, renders, and is discarded. No profile survives,
 * so nothing a page stores can be read by the next call — and `--user-data-dir` on the Chrome
 * backend is process-wide anyway, which would have made per-call isolation a fiction.
 *
 * DEVELOPMENT ONLY for the same reason as the shell executor: this is a shared-kernel container, and
 * the corpus requires microVM isolation for untrusted code
 * (AI_Agent_Implementation_Plan_v2.txt:184). A browser rendering a hostile page is the strongest
 * case for that requirement, not an exception to it.
 */
export class DockerBrowserTool implements Tool {
  readonly name: ToolName;
  /** It fetches and it executes someone else's code; the page decides what else it reaches. */
  readonly actionClass = "sensitive-data-access" as const;
  readonly #image: string;
  readonly #policies: ReadonlyMap<Namespace, EgressPolicy>;

  constructor(options: {
    readonly name: ToolName;
    readonly image: string;
    /** Per tenant, and empty for a tenant nobody granted egress to — see `WebFetchOptions`. */
    readonly policies: ReadonlyMap<Namespace, EgressPolicy>;
  }) {
    this.name = options.name;
    this.#image = options.image;
    this.#policies = options.policies;
  }

  async execute(
    argumentsJson: string,
    namespace: Namespace,
  ): Promise<Result<ToolObservation, ToolFailure>> {
    const parsed = parseUrl(argumentsJson);
    if (!parsed.ok) {
      return err(parsed.error);
    }
    const policy = egressFor(this.#policies, namespace);

    // The requested URL is checked before a browser is started, so a refused target costs nothing.
    // The proxy then re-checks it, and checks everything the page asks for afterwards.
    //
    // Allowlist before DNS, matching the plain fetch: resolving first would hand a DNS server
    // whatever the model encoded in a hostname, and refusing the render afterwards does not take
    // that back. With deny-by-default the common case is a refusal, so this is the ordinary path
    // rather than an edge.
    const allowed = permitHost(parsed.value.url, policy);
    if (!allowed.ok) {
      return err({ kind: "invalid-arguments", reason: allowed.error.kind });
    }
    const address = await resolve(parsed.value.url);
    if (address === undefined) {
      return err({ kind: "execution-failed", reason: "host did not resolve" });
    }
    const permitted = permitUrl(parsed.value.url, address, policy);
    if (!permitted.ok) {
      return err({ kind: "invalid-arguments", reason: permitted.error.kind });
    }

    const proxy = new EgressProxy({ policy });
    try {
      const rendered = await this.#render(String(permitted.value), proxy.port);
      if (!rendered.ok) {
        return err(rendered.error);
      }
      const dom = rendered.value.slice(0, MAX_DOM_BYTES);
      const blocked = [...new Set(proxy.refused)];
      return ok({
        kind: "acted",
        receipt: {
          summary:
            blocked.length === 0
              ? `Rendered ${new URL(String(permitted.value)).hostname}.`
              : `Rendered ${new URL(String(permitted.value)).hostname}; refused ${String(blocked.length)} off-allowlist request(s).`,
          // A rendered page is the least trustworthy text this platform handles: someone else wrote
          // it and their JavaScript chose it. The runtime rails it.
          output: dom,
        },
      });
    } finally {
      await proxy.stop();
    }
  }

  async #render(url: string, proxyPort: number): Promise<Result<string, ToolFailure>> {
    // `host.docker.internal` is how a container reaches a server on the host. Combined with the
    // browser's own proxy setting and no other route configured, every request it makes lands on
    // the allowlist check rather than on the internet.
    const proxyUrl = `http://host.docker.internal:${String(proxyPort)}`;
    const child = Bun.spawn({
      cmd: [
        "docker",
        "run",
        "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "--read-only",
        "--tmpfs=/tmp:rw,noexec,nosuid,size=64m",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=256",
        "--memory=768m",
        "--cpus=1",
        this.#image,
        "chromium-browser",
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--dump-dom",
        `--proxy-server=${proxyUrl}`,
        // Without this, Chrome bypasses the proxy for anything it considers local, which is exactly
        // the set of addresses the policy exists to keep it away from.
        "--proxy-bypass-list=<-loopback>",
        url,
      ],
      stdout: "pipe",
      stderr: "pipe",
      timeout: RENDER_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });

    const exitCode = await child.exited;
    if (child.signalCode === "SIGKILL") {
      return err({ kind: "execution-failed", reason: "render timed out" });
    }
    const stdout = await new Response(child.stdout).text();
    if (exitCode !== 0 && stdout.length === 0) {
      const stderr = await new Response(child.stderr).text();
      return err({ kind: "execution-failed", reason: `browser failed: ${stderr.slice(0, 160)}` });
    }
    return ok(stdout);
  }
}

async function resolve(url: string): Promise<string | undefined> {
  try {
    const [resolved] = await dns.lookup(new URL(url).hostname);
    return resolved?.address;
  } catch {
    return undefined;
  }
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
