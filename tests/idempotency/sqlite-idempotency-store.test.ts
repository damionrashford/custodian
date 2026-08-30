import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { parseSubjectId, parseTenantId, type Namespace } from "@custodian/domain-primitives";
import { bucketFor } from "@custodian/retention";
import {
  CLAIM_TTL_MS,
  parseRequestHash,
  SqliteIdempotencyStore,
  type RecordedOutcome,
} from "@custodian/idempotency";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge-base";

const AT = "2026-08-30T00:00:00.000Z";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

function namespaceOf(id: string): Namespace {
  const tenant = must(parseTenantId(id), "tenant");
  const verifier: ClaimVerifier = {
    verify: () => ({
      ok: true,
      value: {
        tenant,
        issuedAt: "2026-08-29T23:45:00.000Z",
        expiresAt: "2026-08-30T00:15:00.000Z",
      },
    }),
  };
  const claim = verifyTenantClaim("signed", { verifier, now: new Date(AT) });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

const ACME = namespaceOf("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const OTHER = namespaceOf("t_02jd7k9h2m4n6p8r0s2t4v6x8z");
const HASH = must(parseRequestHash("b".repeat(64)), "hash");

const outcome: RecordedOutcome = {
  status: "succeeded",
  body: {
    subject: must(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject"),
    bucket: bucketFor("prompts-and-completions", AT),
    iv: "aXY=",
    ciphertext: "Y2lwaGVy",
    wrappedSubjectKey: "vault:v1:subject",
    wrappedBucketKey: "vault:v1:bucket",
  },
};

function storePath(): string {
  return join(mkdtempSync(join(tmpdir(), "custodian-claims-")), "claims.sqlite");
}

test("a claim survives the process: a redelivery after restart is not new work", async () => {
  const path = storePath();
  const first = new SqliteIdempotencyStore(path);
  expect((await first.claim(ACME, HASH, AT)).ok).toBe(true);
  first.close();

  // The whole point of durability here: a retry that arrives after a restart must still meet the
  // claim the first delivery wrote, or the request executes twice and is billed twice.
  const reopened = new SqliteIdempotencyStore(path);
  const second = await reopened.claim(ACME, HASH, AT);
  if (!second.ok) throw new Error("claim failed");
  expect(second.value.kind).toBe("already-claimed");
});

test("a recorded outcome survives the process", async () => {
  const path = storePath();
  const store = new SqliteIdempotencyStore(path);
  await store.claim(ACME, HASH, AT);
  await store.complete(ACME, HASH, outcome);
  store.close();

  const reopened = new SqliteIdempotencyStore(path);
  const again = await reopened.claim(ACME, HASH, AT);
  if (!again.ok || again.value.kind !== "already-claimed") throw new Error("claim not found");
  expect(again.value.claim.outcome).toEqual(outcome);
});

test("an expired claim is not a claim, so the later request runs", async () => {
  const store = new SqliteIdempotencyStore(storePath());
  await store.claim(ACME, HASH, AT);

  const afterTtl = new Date(Date.parse(AT) + CLAIM_TTL_MS).toISOString();
  const later = await store.claim(ACME, HASH, afterTtl);
  if (!later.ok) throw new Error("claim failed");
  expect(later.value.kind).toBe("claimed");
});

test("two tenants whose requests hash alike do not share a claim", async () => {
  const store = new SqliteIdempotencyStore(storePath());
  await store.claim(ACME, HASH, AT);

  // Keyed by request hash alone, the second tenant would be told its work was already done.
  const other = await store.claim(OTHER, HASH, AT);
  if (!other.ok) throw new Error("claim failed");
  expect(other.value.kind).toBe("claimed");
});

test("completing a claim that was never made is refused", async () => {
  const store = new SqliteIdempotencyStore(storePath());
  expect(await store.complete(ACME, HASH, outcome)).toEqual({
    ok: false,
    error: { kind: "unknown-claim", request: HASH },
  });
});

test("the sweep drops claims past their TTL and leaves live ones alone", async () => {
  const store = new SqliteIdempotencyStore(storePath());
  await store.claim(ACME, HASH, AT);
  await store.claim(OTHER, HASH, AT);

  const withinTtl = new Date(Date.parse(AT) + CLAIM_TTL_MS - 1).toISOString();
  expect(store.sweepExpired(withinTtl)).toBe(0);
  expect(store.sweepExpired(new Date(Date.parse(AT) + CLAIM_TTL_MS).toISOString())).toBe(2);

  // A swept claim is gone, not remembered as expired: the same request is new work again.
  const again = await store.claim(ACME, HASH, AT);
  if (!again.ok) throw new Error("claim failed");
  expect(again.value.kind).toBe("claimed");
});

test("a stored outcome that no longer parses reads back as in-flight, never as a result", async () => {
  const path = storePath();
  const store = new SqliteIdempotencyStore(path);
  await store.claim(ACME, HASH, AT);
  await store.complete(ACME, HASH, outcome);
  store.close();

  // A hand-edited or half-migrated row is untrusted input like any other. Handing its remains back
  // as a completed result would answer a redelivery with a body no key can open.
  const raw = new Database(path, { strict: true });
  raw.run("UPDATE claims SET outcome = ?", ['{"status":"succeeded","body":{"iv":"aXY="}}']);
  raw.close();

  const reopened = new SqliteIdempotencyStore(path);
  const again = await reopened.claim(ACME, HASH, AT);
  if (!again.ok || again.value.kind !== "already-claimed") throw new Error("claim lost");
  expect(again.value.claim.outcome).toBeUndefined();
});

test("a claim is recorded before any outcome, so a crash mid-flight still dedupes", async () => {
  const path = storePath();
  const store = new SqliteIdempotencyStore(path);
  const claimed = await store.claim(ACME, HASH, AT);
  if (!claimed.ok || claimed.value.kind !== "claimed") throw new Error("claim failed");
  expect(claimed.value.claim.outcome).toBeUndefined();
  store.close();

  // No complete() call — the process "died" mid-run. The redelivery must see an in-flight claim
  // rather than starting the work again.
  const reopened = new SqliteIdempotencyStore(path);
  const second = await reopened.claim(ACME, HASH, AT);
  if (!second.ok || second.value.kind !== "already-claimed") throw new Error("claim lost");
  expect(second.value.claim.outcome).toBeUndefined();
});
