import { expect, test } from "bun:test";
import {
  EnvelopeSubjectKeyStore,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
} from "@custodian/crypto-shred";
import { parseRetentionBucket, parseSubjectId, parseTenantId } from "@custodian/domain-primitives";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge-base";
import {
  CLAIM_TTL_MS,
  executeOnce,
  InMemoryIdempotencyStore,
  isExpired,
  parseRequestHash,
  type RecordedOutcome,
} from "@custodian/idempotency";

const keys = new EnvelopeSubjectKeyStore({
  custodian: new InMemoryKeyCustodian({ now: () => new Date("2026-08-29T00:00:00.000Z") }),
  registry: new SqliteDeletionRegistry(":memory:"),
});

async function sealedBody(plaintext: string) {
  const subject = parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z");
  const bucket = parseRetentionBucket("content-2026-08");
  if (!subject.ok || !bucket.ok) throw new Error("fixture");
  const sealed = await keys.seal({ subject: subject.value, bucket: bucket.value, plaintext });
  if (!sealed.ok) throw new Error("seal failed");
  return sealed.value;
}

const HASH = "a".repeat(64);

const claimVerifier: ClaimVerifier = {
  verify: () => ({
    ok: true,
    value: {
      tenant: parsedTenant(),
      issuedAt: "2026-08-28T23:45:00.000Z",
      expiresAt: "2026-08-29T00:15:00.000Z",
    },
  }),
};

function parsedTenant() {
  const parsed = parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
  if (!parsed.ok) throw new Error("fixture: bad tenant");
  return parsed.value;
}

function otherNamespace() {
  const tenant = parseTenantId("t_02jd7k9h2m4n6p8r0s2t4v6x8z");
  if (!tenant.ok) throw new Error("fixture: bad tenant");
  const verifier: ClaimVerifier = {
    verify: () => ({
      ok: true,
      value: {
        tenant: tenant.value,
        issuedAt: "2026-08-28T23:45:00.000Z",
        expiresAt: "2026-08-29T00:15:00.000Z",
      },
    }),
  };
  const claim = verifyTenantClaim("signed", {
    verifier,
    now: new Date("2026-08-29T00:00:00.000Z"),
  });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

function namespace() {
  const claim = verifyTenantClaim("signed", {
    verifier: claimVerifier,
    now: new Date("2026-08-29T00:00:00.000Z"),
  });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

function hash() {
  const parsed = parseRequestHash(HASH);
  if (!parsed.ok) throw new Error("fixture: bad request hash");
  return parsed.value;
}

const SUCCESS: RecordedOutcome = { status: "succeeded", body: await sealedBody("charged once") };

test("the claim is persisted before the provider is invoked", async () => {
  const order: string[] = [];
  const store = new InMemoryIdempotencyStore({
    onWrite: () => {
      order.push("claim");
    },
  });

  await executeOnce({
    store,
    namespace: namespace(),
    request: hash(),
    at: "2026-08-29T00:00:00.000Z",
    invoke: () => {
      order.push("invoke");
      return Promise.resolve(SUCCESS);
    },
  });

  expect(order[0]).toBe("claim");
  expect(order).toContain("invoke");
});

test("a second delivery returns the first outcome without invoking again", async () => {
  const store = new InMemoryIdempotencyStore({ onWrite: () => undefined });
  let invocations = 0;
  const invoke = () => {
    invocations += 1;
    return Promise.resolve(SUCCESS);
  };

  const first = await executeOnce({
    store,
    namespace: namespace(),
    request: hash(),
    at: "2026-08-29T00:00:00.000Z",
    invoke,
  });
  const second = await executeOnce({
    store,
    namespace: namespace(),
    request: hash(),
    at: "2026-08-29T00:00:05.000Z",
    invoke,
  });

  expect(first).toEqual({ ok: true, value: SUCCESS });
  expect(second).toEqual({ ok: true, value: SUCCESS });
  expect(invocations).toBe(1);
});

test("a replay arriving before the first call completes is refused, not duplicated", async () => {
  const store = new InMemoryIdempotencyStore({ onWrite: () => undefined });
  const claimed = await store.claim(namespace(), hash(), "2026-08-29T00:00:00.000Z");
  expect(claimed.ok).toBe(true);

  const replay = await executeOnce({
    store,
    namespace: namespace(),
    request: hash(),
    at: "2026-08-29T00:00:01.000Z",
    invoke: () => Promise.reject(new Error("must not be invoked")),
  });

  expect(replay).toEqual({ ok: false, error: { kind: "in-flight", request: hash() } });
});

test("a claim carries an expiry, so the store does not grow without bound", async () => {
  const store = new InMemoryIdempotencyStore({ onWrite: () => undefined });
  const claimed = await store.claim(namespace(), hash(), "2026-08-29T00:00:00.000Z");
  if (!claimed.ok) throw new Error("claim failed");

  expect(Date.parse(claimed.value.claim.expiresAt) - Date.parse("2026-08-29T00:00:00.000Z")).toBe(
    CLAIM_TTL_MS,
  );
});

test("an expired claim does not dedupe a legitimate later request", async () => {
  const store = new InMemoryIdempotencyStore({ onWrite: () => undefined });
  let invocations = 0;
  const invoke = () => {
    invocations += 1;
    return Promise.resolve(SUCCESS);
  };

  await executeOnce({
    store,
    namespace: namespace(),
    request: hash(),
    at: "2026-08-29T00:00:00.000Z",
    invoke,
  });
  // A month later the same request is genuinely new work, not a replay.
  await executeOnce({
    store,
    namespace: namespace(),
    request: hash(),
    at: "2026-09-29T00:00:00.000Z",
    invoke,
  });

  expect(invocations).toBe(2);
});

test("isExpired is inclusive at the boundary", async () => {
  const store = new InMemoryIdempotencyStore({ onWrite: () => undefined });
  const claimed = await store.claim(namespace(), hash(), "2026-08-29T00:00:00.000Z");
  if (!claimed.ok) throw new Error("claim failed");

  expect(isExpired(claimed.value.claim, claimed.value.claim.expiresAt)).toBe(true);
});

test("two tenants whose requests hash alike do not share a claim", async () => {
  const store = new InMemoryIdempotencyStore({ onWrite: () => undefined });
  const other = otherNamespace();
  let invocations = 0;
  const invoke = () => {
    invocations += 1;
    return Promise.resolve(SUCCESS);
  };

  // Keyed by hash alone, the second tenant is told its work was already done and receives the
  // first tenant's outcome. Whether the tenant is inside the hash is the caller's undocumented
  // responsibility; the store enforces it here instead.
  await executeOnce({
    store,
    namespace: namespace(),
    request: hash(),
    at: "2026-08-29T00:00:00.000Z",
    invoke,
  });
  await executeOnce({
    store,
    namespace: other,
    request: hash(),
    at: "2026-08-29T00:00:00.000Z",
    invoke,
  });

  expect(invocations).toBe(2);
});
