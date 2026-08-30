import { dns } from "bun";
import { permitHost, permitUrl, type EgressPolicy } from "../domain/url-policy";

/**
 * The one way out of the browser sandbox.
 *
 * A shell sandbox can run with no network at all, which is why the shell executor's allowlist is
 * unimplemented and says so. A browser cannot: it exists to fetch things. That makes the allowlist
 * load-bearing rather than aspirational, and it has to be enforced somewhere the page cannot reach
 * around — so the container gets no route to the internet and this is the only address it can talk
 * to. "Network egress from the sandbox is deny-by-default with an allowlist, tested adversarially"
 * (Test_and_Security_Assurance.txt:95).
 *
 * Enforcing at the proxy rather than at the tool matters because the tool only ever sees the URL the
 * model asked for. A page then requests its own scripts, images and beacons, and those are chosen by
 * whoever wrote the page. Every one of them arrives here.
 */
export class EgressProxy {
  readonly #policy: EgressPolicy;
  readonly #server: ReturnType<typeof Bun.serve>;
  /** Hosts a request was refused for, so a caller can see what a page tried to reach. */
  readonly refused: string[] = [];

  constructor(options: { readonly policy: EgressPolicy; readonly port?: number }) {
    this.#policy = options.policy;
    this.#server = Bun.serve({
      port: options.port ?? 0,
      // The container talks to the host, so binding to loopback only would be unreachable from it.
      hostname: "0.0.0.0",
      fetch: (request) => this.#forward(request),
    });
  }

  get port(): number {
    return this.#server.port ?? 0;
  }

  stop(): Promise<void> {
    return this.#server.stop(true).then(() => undefined);
  }

  async #forward(request: Request): Promise<Response> {
    const target = request.url.startsWith("http")
      ? request.url
      : `http://${request.headers.get("host") ?? ""}${new URL(request.url).pathname}`;

    // Allowlist first, DNS second. Resolving before deciding would hand every hostname a page names
    // to a DNS server, which is a working exfiltration channel even when the fetch is then refused.
    const allowed = permitHost(target, this.#policy);
    if (!allowed.ok) {
      this.refused.push(hostnameOf(target));
      return new Response(`refused: ${allowed.error.kind}`, { status: 403 });
    }
    const hostname = allowed.value;

    let address: string;
    try {
      const [resolved] = await dns.lookup(hostname);
      address = resolved?.address ?? "";
    } catch {
      return new Response("unresolvable", { status: 502 });
    }

    const permitted = permitUrl(target, address, this.#policy);
    if (!permitted.ok) {
      // Recorded, not just refused. A page reaching for a host nobody allowlisted is the signal
      // that something is trying to exfiltrate, and it is worth more than a dropped packet.
      this.refused.push(hostname);
      return new Response(`refused: ${permitted.error.kind}`, { status: 403 });
    }

    try {
      return await fetch(String(permitted.value), {
        method: request.method,
        headers: request.headers,
        // Manual, so a permitted host cannot 302 the browser somewhere this would not have allowed.
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return new Response("upstream failed", { status: 502 });
    }
  }
}

/** Best-effort, for the refusal record only — a target too malformed to parse still gets logged. */
function hostnameOf(target: string): string {
  try {
    return new URL(target).hostname;
  } catch {
    return target;
  }
}
