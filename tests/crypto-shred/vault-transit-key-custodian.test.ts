import { expect, test } from "bun:test";
import {
  subjectKeyName,
  VaultTransitKeyCustodian,
  type CustodyKeyName,
  type VaultResponse,
  type VaultTransport,
} from "@custodian/crypto-shred";
import { isRecord, parseSubjectId } from "@custodian/domain-primitives";

const SUBJECT = "s_01jd7k9h2m4n6p8r0s2t4v6x8z";

/**
 * Transit's semantics, not a stub that says yes. A key must exist before a data key can be issued
 * against it, and once the key is deleted a decrypt of anything wrapped under it fails — which is
 * the only property the custodian's erasure guarantee actually rests on.
 *
 * This is also why the custodian takes a transport rather than a URL: `tests/standards.test.ts`
 * fails the build on an `http(s)://` literal anywhere under `tests/`, because a network dependency
 * inside a blocking gate is worse than no gate at all.
 */
class FakeTransitTransport implements VaultTransport {
  readonly keys = new Set<string>();
  readonly requests: string[] = [];
  readonly #wrapped = new Map<string, string>();

  send(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<VaultResponse> {
    this.requests.push(`${method} ${path}`);
    return Promise.resolve(this.#route(method, path, body));
  }

  #route(method: string, path: string, body: unknown): VaultResponse {
    const name = keyNameFrom(path);
    if (method === "GET") {
      return this.keys.has(name) ? { status: 200, body: { data: { name } } } : NOT_FOUND;
    }
    if (method === "DELETE") {
      this.keys.delete(name);
      return NO_CONTENT;
    }
    if (path.endsWith("/config")) {
      return NO_CONTENT;
    }
    if (path.startsWith("/v1/transit/keys/")) {
      this.keys.add(name);
      return NO_CONTENT;
    }
    if (path.startsWith("/v1/transit/datakey/plaintext/")) {
      return this.#issue(name);
    }
    return this.#decrypt(name, readCiphertext(body));
  }

  #issue(name: string): VaultResponse {
    if (!this.keys.has(name)) {
      return { status: 400, body: { errors: ["no such key"] } };
    }
    const plaintext = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
    const ciphertext = `vault:v1:${String(this.#wrapped.size)}`;
    this.#wrapped.set(ciphertext, plaintext);
    return { status: 200, body: { data: { plaintext, ciphertext } } };
  }

  #decrypt(name: string, ciphertext: string): VaultResponse {
    // The property the whole erasure guarantee rests on: once the key is gone, nothing wrapped
    // under it decrypts, however intact the ciphertext still is.
    const plaintext = this.keys.has(name) ? this.#wrapped.get(ciphertext) : undefined;
    return plaintext === undefined
      ? { status: 400, body: { errors: ["decryption failed"] } }
      : { status: 200, body: { data: { plaintext } } };
  }
}

const NO_CONTENT: VaultResponse = { status: 204, body: undefined };
const NOT_FOUND: VaultResponse = { status: 404, body: {} };

function keyNameFrom(path: string): string {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  const last = segments[segments.length - 1] ?? "";
  if (last !== "config") {
    return decodeURIComponent(last);
  }
  const previous = segments[segments.length - 2] ?? "";
  return decodeURIComponent(previous);
}

function readCiphertext(body: unknown): string {
  if (!isRecord(body)) {
    return "";
  }
  const value = body["ciphertext"];
  return typeof value === "string" ? value : "";
}

function name(): CustodyKeyName {
  const parsed = parseSubjectId(SUBJECT);
  if (!parsed.ok) {
    throw new Error("fixture did not parse");
  }
  return subjectKeyName(parsed.value);
}

function custodianOver(transport: VaultTransport): VaultTransitKeyCustodian {
  return new VaultTransitKeyCustodian({
    transport,
    now: () => new Date("2026-08-30T00:00:00.000Z"),
  });
}

test("a data key round-trips through the transit engine", async () => {
  const custodian = custodianOver(new FakeTransitTransport());

  const issued = await custodian.issueDataKey(name());
  if (!issued.ok) {
    throw new Error("issue failed");
  }
  const unwrapped = await custodian.unwrapDataKey(name(), issued.value.wrapped);
  if (!unwrapped.ok) {
    throw new Error("unwrap failed");
  }

  expect(Buffer.from(unwrapped.value).equals(Buffer.from(issued.value.plaintext))).toBe(true);
});

test("creating a key permits its deletion in the same breath", async () => {
  const transport = new FakeTransitTransport();
  await custodianOver(transport).issueDataKey(name());

  // Transit refuses DELETE unless deletion_allowed is set on the key's config, and key creation is
  // the only moment guaranteed to precede the erasure request. A key created without it is a data
  // subject who cannot be erased, discovered while a statutory clock is running.
  expect(transport.requests).toContain(`POST /v1/transit/keys/subject-${SUBJECT}/config`);
});

test("unwrapping under a destroyed key fails rather than returning nothing", async () => {
  const transport = new FakeTransitTransport();
  const custodian = custodianOver(transport);
  const issued = await custodian.issueDataKey(name());
  if (!issued.ok) {
    throw new Error("issue failed");
  }

  await custodian.destroyKey(name());

  const unwrapped = await custodian.unwrapDataKey(name(), issued.value.wrapped);
  expect(unwrapped.ok ? "unwrapped" : unwrapped.error.kind).toBe("key-destroyed");
});

test("destroying a key attests externally only once the key is observably gone", async () => {
  const transport = new FakeTransitTransport();
  const custodian = custodianOver(transport);
  await custodian.issueDataKey(name());

  const proof = await custodian.destroyKey(name());
  if (!proof.ok) {
    throw new Error("destroy failed");
  }

  expect(proof.value.attestation).toBe("external");
  expect(proof.value.keyReference).toBe(`vault:transit/keys/subject-${SUBJECT}`);
  expect(transport.keys.has(`subject-${SUBJECT}`)).toBe(false);
});

test("a delete the custodian cannot confirm is not a proof at all", async () => {
  class DeleteThatDoesNothing extends FakeTransitTransport {
    override send(
      method: "GET" | "POST" | "DELETE",
      path: string,
      body?: unknown,
    ): Promise<VaultResponse> {
      // Vault answered 204 and the key is still there — a partitioned standby, a policy granting
      // delete but not read, a proxy that lied. Whatever the cause, this platform has not watched
      // anything be destroyed, so it must not sign a record saying that it did.
      return method === "DELETE"
        ? Promise.resolve({ status: 204, body: undefined })
        : super.send(method, path, body);
    }
  }

  const transport = new DeleteThatDoesNothing();
  const custodian = custodianOver(transport);
  await custodian.issueDataKey(name());

  const proof = await custodian.destroyKey(name());
  expect(proof.ok ? "proved" : proof.error.kind).toBe("destruction-unconfirmed");
});

test("an unreachable custodian is not reported as an erased subject", async () => {
  class Unreachable implements VaultTransport {
    send(): Promise<VaultResponse> {
      return Promise.resolve({ status: 0, body: { unreachable: "connection refused" } });
    }
  }

  // A socket timeout must never read as "this person has been erased". The erasure workflow retries
  // an infrastructure fault and escalates an identity one; collapsing them sends each to the wrong
  // place.
  const unwrapped = await custodianOver(new Unreachable()).unwrapDataKey(name(), "vault:v1:0");
  expect(unwrapped.ok ? "unwrapped" : unwrapped.error.kind).toBe("custodian-unreachable");
});
