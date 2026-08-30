import { expect, test } from "bun:test";
import { EgressProxy } from "@custodian/agent";

/**
 * The proxy is where the allowlist is actually enforced, because a page requests its own
 * subresources and the tool never sees those URLs. These drive it over a real socket for that
 * reason — a fake would assert the policy call this makes, which is the part already tested.
 */
function proxyFor(allowedHosts: readonly string[]): EgressProxy {
  return new EgressProxy({ policy: { allowedHosts } });
}

test("a request for a host nobody allowlisted is refused", async () => {
  const proxy = proxyFor([]);
  try {
    const refused = await fetch(`http://127.0.0.1:${String(proxy.port)}/`, {
      headers: { host: "evil.example.net" },
    });
    expect(refused.status).toBe(403);
    expect(await refused.text()).toContain("host-not-allowlisted");
  } finally {
    await proxy.stop();
  }
});

test("what a page tried to reach is recorded, not merely dropped", async () => {
  const proxy = proxyFor([]);
  try {
    await fetch(`http://127.0.0.1:${String(proxy.port)}/beacon`, {
      headers: { host: "tracker.example.net" },
    });
    // A page reaching for an off-allowlist host is the signal that something is exfiltrating, and
    // it is worth more than a dropped packet.
    expect(proxy.refused).toContain("tracker.example.net");
  } finally {
    await proxy.stop();
  }
});

test("an allowlisted name that resolves privately is still refused", async () => {
  // localhost is on the allowlist and resolves to 127.0.0.1, so this is the case where the host
  // check passes and only the address check stands between a page and the host's own services.
  const proxy = proxyFor(["localhost"]);
  try {
    const refused = await fetch(`http://127.0.0.1:${String(proxy.port)}/`, {
      headers: { host: "localhost" },
    });
    expect(refused.status).toBe(403);
    expect(await refused.text()).toContain("address-not-public");
  } finally {
    await proxy.stop();
  }
});
