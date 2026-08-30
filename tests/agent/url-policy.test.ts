import { expect, test } from "bun:test";
import { permitUrl, type EgressPolicy } from "@custodian/agent";

const POLICY: EgressPolicy = { allowedHosts: ["docs.example.com"] };
const PUBLIC = "93.184.216.34";

test("an allowlisted host resolving publicly is permitted", () => {
  const permitted = permitUrl("https://docs.example.com/a/page", PUBLIC, POLICY);
  expect(permitted.ok).toBe(true);
});

test("only http and https are permitted", () => {
  // Bun's fetch also resolves file:, s3:, data: and blob: URLs, so an unchecked fetch of a
  // model-supplied string reads local files. An allowlist of two schemes is the fix; a blocklist
  // would be wrong again the next time Bun adds a protocol.
  for (const [url, scheme] of [
    ["file:///etc/passwd", "file:"],
    ["s3://a-bucket/secret", "s3:"],
    ["data:text/plain;base64,SGk=", "data:"],
    ["blob:https://docs.example.com/abc", "blob:"],
  ] as const) {
    const permitted = permitUrl(url, PUBLIC, POLICY);
    if (permitted.ok || permitted.error.kind !== "scheme-not-permitted") {
      throw new Error(`${url} was not refused for its scheme`);
    }
    expect(permitted.error.scheme).toBe(scheme);
  }
});

test("a host that is not allowlisted is refused", () => {
  const permitted = permitUrl("https://elsewhere.example.net/", PUBLIC, POLICY);
  expect(permitted.ok ? "allowed" : permitted.error.kind).toBe("host-not-allowlisted");
});

test("an empty allowlist means no web access at all", () => {
  const permitted = permitUrl("https://docs.example.com/", PUBLIC, { allowedHosts: [] });
  expect(permitted.ok).toBe(false);
});

test("an allowlisted name resolving to a private address is refused", () => {
  // The ordinary shape of an SSRF: the name is fine, the address is not. Checking the hostname
  // alone would pass every one of these.
  for (const address of [
    "127.0.0.1",
    "169.254.169.254",
    "10.0.0.5",
    "172.16.4.4",
    "192.168.1.1",
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "fe80::1",
    "fd00::1",
    "::ffff:169.254.169.254",
  ]) {
    const permitted = permitUrl("https://docs.example.com/", address, POLICY);
    expect([address, permitted.ok ? "allowed" : permitted.error.kind]).toEqual([
      address,
      "address-not-public",
    ]);
  }
});

test("credentials in the url are refused", () => {
  // Otherwise a fetch tool is a credential-exfiltration tool: the model writes them and they land
  // in the request, the logs, and the target's access log.
  const permitted = permitUrl("https://user:secret@docs.example.com/", PUBLIC, POLICY);
  expect(permitted.ok ? "allowed" : permitted.error.kind).toBe("credentials-in-url");
});

test("an unparseable url is refused rather than coerced", () => {
  expect(permitUrl("not a url", PUBLIC, POLICY).ok).toBe(false);
});
