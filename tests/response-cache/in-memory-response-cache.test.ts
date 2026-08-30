import { expect, test } from "bun:test";
import { AesGcmSubjectKeyStore } from "@custodian/crypto-shred";
import {
  parseRetentionBucket,
  parseSubjectId,
  parseTenantId,
  type SealedContent,
} from "@custodian/domain-primitives";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge-base";
import { cacheKeyFor, InMemoryResponseCache } from "@custodian/response-cache";
import { Sha256ContentHasher } from "@custodian/execution-log";

const STORED_AT = "2026-08-29T00:00:00.000Z";
const SAME_DAY = "2026-08-29T06:00:00.000Z";
/** One day past the 30-day "prompts and completions" period. */
const PAST_RETENTION = "2026-09-29T00:00:00.000Z";

const digest = new Sha256ContentHasher();
const keys = new AesGcmSubjectKeyStore({ now: () => new Date(STORED_AT) });

async function seal(plaintext: string): Promise<SealedContent> {
  const subject = parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z");
  const bucket = parseRetentionBucket("content-2026-08");
  if (!subject.ok || !bucket.ok) throw new Error("fixture");
  const sealed = await keys.seal({ subject: subject.value, bucket: bucket.value, plaintext });
  if (!sealed.ok) throw new Error("seal failed");
  return sealed.value;
}

const verifier: ClaimVerifier = {
  verify: (token) => {
    const parsed = parseTenantId(token);
    return parsed.ok
      ? {
          ok: true,
          value: {
            tenant: parsed.value,
            issuedAt: "2026-08-28T23:45:00.000Z",
            expiresAt: "2026-08-29T00:15:00.000Z",
          },
        }
      : { ok: false, error: { kind: "signature-invalid" } };
  },
};

function namespace(id: string) {
  const claim = verifyTenantClaim(id, { verifier, now: new Date(STORED_AT) });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

const ACME = namespace("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const GLOBEX = namespace("t_02jd7k9h2m4n6p8r0s2t4v6x8z");
const MODEL = "frontier-1.5-20260801";
const PROMPT = "What is the refund window?";

const keyFor = (ns: typeof ACME, model = MODEL, prompt = PROMPT) =>
  cacheKeyFor(ns, model, prompt, digest);

test("a byte-identical prompt hits", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(keyFor(ACME), ACME, await seal("Thirty days."), STORED_AT);
  expect(cache.get(keyFor(ACME), SAME_DAY)).toBeDefined();
});

test("a one-character difference MISSES — this is exact match, not similarity", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(keyFor(ACME), ACME, await seal("Thirty days."), STORED_AT);
  expect(cache.get(keyFor(ACME, MODEL, "What is the refund window!"), SAME_DAY)).toBeUndefined();
});

test("the same prompt under a different model misses", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(keyFor(ACME), ACME, await seal("Thirty days."), STORED_AT);
  expect(cache.get(keyFor(ACME, "small-1.0-20260801"), SAME_DAY)).toBeUndefined();
});

test("one tenant never reads another tenant's cached answer", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(keyFor(ACME), ACME, await seal("Thirty days."), STORED_AT);
  expect(cache.get(keyFor(GLOBEX), SAME_DAY)).toBeUndefined();
});

test("invalidating one namespace leaves another intact", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(keyFor(ACME), ACME, await seal("Thirty days."), STORED_AT);
  cache.set(keyFor(GLOBEX), GLOBEX, await seal("Sixty days."), STORED_AT);

  expect(cache.invalidateNamespace(ACME)).toBe(1);
  expect(cache.get(keyFor(ACME), SAME_DAY)).toBeUndefined();
  expect(cache.get(keyFor(GLOBEX), SAME_DAY)).toBeDefined();
});

test("the key is a digest, so the prompt is not readable from the cache index", () => {
  expect(String(keyFor(ACME))).not.toContain("refund");
  expect(String(keyFor(ACME))).toMatch(/^[0-9a-f]{64}$/);
});

test("an entry past its retention period does not hit, even though it was stored", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(keyFor(ACME), ACME, await seal("Thirty days."), STORED_AT);
  expect(cache.get(keyFor(ACME), PAST_RETENTION)).toBeUndefined();
});

test("an expired entry is dropped on read, so an unswept cache cannot serve stale content", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(keyFor(ACME), ACME, await seal("Thirty days."), STORED_AT);

  expect(cache.get(keyFor(ACME), PAST_RETENTION)).toBeUndefined();
  // Gone from storage too — a later read at a valid time must not resurrect it.
  expect(cache.invalidateNamespace(ACME)).toBe(0);
});
