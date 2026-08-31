import { brand, type Brand, err, ok, type Namespace, type Result } from "@custodian/primitives";

/**
 * A URL that has been checked against the egress policy and may be fetched.
 *
 * Branded because "checked" and "not checked" are the same type otherwise, and the one place that
 * distinction matters is the line immediately before the request goes out.
 */
export type PermittedUrl = Brand<string, "PermittedUrl">;

export type UrlRejection =
  | { readonly kind: "url-unparseable"; readonly requested: string }
  | { readonly kind: "scheme-not-permitted"; readonly scheme: string }
  | { readonly kind: "host-not-allowlisted"; readonly host: string }
  | { readonly kind: "credentials-in-url" }
  | { readonly kind: "address-not-public"; readonly address: string };

/**
 * Bun's `fetch` is not only an HTTP client. It also resolves `file:`, `s3:`, `data:` and `blob:`
 * URLs (/runtime/networking/fetch — "Protocol support"), so `fetch(modelSuppliedUrl)` will happily
 * read `file:///etc/passwd` off the host and hand it back as a response body.
 *
 * That is the reason this is an allowlist of two schemes rather than a blocklist of the bad ones:
 * a blocklist would have had to know about all four, and would be wrong again the next time Bun
 * adds a protocol.
 */
const PERMITTED_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * Ranges that must never be reachable from a tool the model can aim.
 *
 * The link-local block is the one that matters most in a deployed environment: 169.254.169.254 is
 * the cloud instance metadata endpoint, and reaching it returns credentials. It is denied at the
 * sandbox, at the platform's own network rules, and here — three independent places, because an
 * SSRF that reaches it is a full compromise rather than a leak.
 */
function isPublicAddress(address: string): boolean {
  if (address.includes(":")) {
    const normalised = address.toLowerCase();
    // ::1 loopback, fe80:: link-local, fc00::/7 unique-local, and the v4-mapped forms.
    if (normalised === "::1" || normalised === "::" || normalised.startsWith("fe80:")) {
      return false;
    }
    if (normalised.startsWith("fc") || normalised.startsWith("fd")) {
      return false;
    }
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalised);
    return mapped?.[1] === undefined ? true : isPublicAddress(mapped[1]);
  }

  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  const [a, b] = octets;
  if (octets.length !== 4 || a === undefined || b === undefined || octets.some(Number.isNaN)) {
    return false;
  }
  if (a === 0 || a === 10 || a === 127) {
    return false;
  }
  if (a === 169 && b === 254) {
    return false;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return false;
  }
  if (a === 192 && b === 168) {
    return false;
  }
  // 100.64/10 carrier-grade NAT, and everything from 224 up (multicast, reserved, broadcast).
  if (a === 100 && b >= 64 && b <= 127) {
    return false;
  }
  return a < 224;
}

export type EgressPolicy = {
  /**
   * Hosts this agent may reach. Deny-by-default with an allowlist is the corpus requirement, and it
   * is stated as something to test adversarially rather than to configure once
   * (test-and-security-assurance.txt:95). An empty allowlist means no web access, which is the only
   * setting that needs no justification.
   */
  readonly allowedHosts: readonly string[];
};

/**
 * What a tenant nobody granted egress to gets. Named rather than written inline at each call site,
 * because the empty allowlist is the *decision* — an unconfigured agent has no web access — and a
 * decision that only exists as a `?? { allowedHosts: [] }` is one a later refactor reads as a
 * placeholder.
 */
const NO_EGRESS: EgressPolicy = { allowedHosts: [] };

/**
 * Which hosts this tenant may reach.
 *
 * Keyed by `Namespace` for the same reason the workspace root is: the only constructor takes a
 * verified claim, so a run cannot name — and therefore cannot inherit — another tenant's allowlist.
 * A miss is `NO_EGRESS` rather than a shared default, which makes "not configured" and "configured
 * to reach nothing" the same outcome. Deny-by-default with an allowlist is what the corpus asks for,
 * and it asks for it as something tested adversarially rather than configured once
 * (test-and-security-assurance.txt:95).
 */
export function egressFor(
  policies: ReadonlyMap<Namespace, EgressPolicy>,
  namespace: Namespace,
): EgressPolicy {
  return policies.get(namespace) ?? NO_EGRESS;
}

/**
 * Decides whether a URL may be fetched, given where its host actually resolves.
 *
 * The resolved address is a parameter rather than something this function looks up, so the whole
 * decision stays pure and testable — and so the caller is forced to have resolved it. A policy that
 * checked only the hostname would pass `evil.example.com` straight through to 169.254.169.254.
 *
 * The honest limit, stated because it cannot be fixed here: between this check and the socket, the
 * name could resolve again to a different address — DNS rebinding. Bun caches lookups for 30
 * seconds by default (/runtime/networking/dns), which narrows the window but does not close it.
 * Closing it needs the connection pinned to the address that was checked, which the sandbox's
 * deny-by-default egress does structurally and this function cannot.
 */
/**
 * Everything decidable without touching the network: the scheme, the absence of credentials, and
 * whether anyone allowlisted this host.
 *
 * Split out so it can run *before* DNS. Resolving first and checking after looks equivalent and is
 * not: a page can encode data in a hostname it never expects to reach, and the lookup alone hands
 * that string to a DNS server. Refusing the fetch afterwards does not take it back. This is also
 * what makes an off-allowlist host that fails to resolve show up as a refusal rather than as a
 * network error, which matters because the refusal is the signal worth keeping.
 */
export function permitHost(requested: string, policy: EgressPolicy): Result<string, UrlRejection> {
  let url: URL;
  try {
    url = new URL(requested);
  } catch {
    return err({ kind: "url-unparseable", requested });
  }
  if (!PERMITTED_SCHEMES.has(url.protocol)) {
    return err({ kind: "scheme-not-permitted", scheme: url.protocol });
  }
  // Credentials in a URL are how a fetch tool becomes a credential-exfiltration tool: the model
  // writes them, and they land in the request, the logs and the target's access log.
  if (url.username.length > 0 || url.password.length > 0) {
    return err({ kind: "credentials-in-url" });
  }
  return policy.allowedHosts.includes(url.hostname)
    ? ok(url.hostname)
    : err({ kind: "host-not-allowlisted", host: url.hostname });
}

export function permitUrl(
  requested: string,
  resolvedAddress: string,
  policy: EgressPolicy,
): Result<PermittedUrl, UrlRejection> {
  const host = permitHost(requested, policy);
  if (!host.ok) {
    return err(host.error);
  }
  if (!isPublicAddress(resolvedAddress)) {
    return err({ kind: "address-not-public", address: resolvedAddress });
  }
  return ok(brand<PermittedUrl>(new URL(requested).toString()));
}
