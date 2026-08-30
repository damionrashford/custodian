/** One KMS response, before anything has decided whether it is good news. */
export type VaultResponse = {
  readonly status: number;
  readonly body: unknown;
};

/**
 * The seam between the custodian's protocol knowledge and the network. It exists for two reasons,
 * and the second is not incidental: the custodian's behaviour is testable against a fake that models
 * Transit's semantics, and no test file has to contain a URL — `tests/standards.test.ts` fails the
 * build on an `http(s)://` literal under `tests/`, because a network dependency inside a blocking
 * gate is worse than no gate.
 */
export interface VaultTransport {
  send(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<VaultResponse>;
}

/**
 * The one implementation that touches the network.
 *
 * It never throws on a non-2xx. The custodian distinguishes 404 (the key is gone, which is what a
 * confirmed destruction looks like) from 400 (the key exists and refused) from 204, and an exception
 * collapses all three into "something went wrong" — losing exactly the signal that decides whether
 * an erasure proof may be written.
 */
export class HttpVaultTransport implements VaultTransport {
  readonly #address: string;
  readonly #token: string;
  readonly #timeoutMs: number;

  constructor(options: {
    readonly address: string;
    readonly token: string;
    readonly timeoutMs: number;
  }) {
    // Trailing slash trimmed here so callers may write either form; every path below starts with one.
    this.#address = options.address.replace(/\/+$/, "");
    this.#token = options.token;
    this.#timeoutMs = options.timeoutMs;
  }

  async send(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<VaultResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.#address}${path}`, {
        method,
        headers:
          body === undefined
            ? { "X-Vault-Token": this.#token }
            : { "X-Vault-Token": this.#token, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (cause) {
      // Status 0 is not a Vault status. It is this transport saying the request never got an
      // answer, which the custodian must treat as unreachable rather than as a destroyed key.
      return { status: 0, body: { unreachable: String(cause) } };
    }

    if (response.status === 204) {
      return { status: 204, body: undefined };
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      parsed = undefined;
    }
    return { status: response.status, body: parsed };
  }
}
