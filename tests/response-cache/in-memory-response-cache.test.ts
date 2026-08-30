import { expect, test } from "bun:test";
import { parseTenantId } from "@custodian/domain-primitives";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge-base";
import { AesGcmSubjectKeyStore } from "@custodian/crypto-shred";
import {
  parseRetentionBucket,
  parseSubjectId,
  type SealedContent,
} from "@custodian/domain-primitives";
import { cacheKeyFor, InMemoryResponseCache, Sha256KeyDigest } from "@custodian/response-cache";

const digest = new Sha256KeyDigest();
const keys = new AesGcmSubjectKeyStore({ now: () => new Date("2026-08-29T00:00:00.000Z") });

async function seal(plaintext: string): Promise<SealedContent> {
  const subject = parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z");
  const bucket = parseRetentionBucket("content-2026-08");
  if (!subject.ok || !bucket.ok) throw new Error("fixture");
  const sealed = await keys.seal({ subject: subject.value, bucket: bucket.value, plaintext });
  if (!sealed.ok) throw new Error("seal failed");
  return sealed.value;
}

const NOW = new Date("2026-08-29T12:00:00.000Z");

const verifier: ClaimVerifier = {
  verify: (token) => {
    const parsed = parseTenantId(token);
    return parsed.ok
      ? {
          ok: true,
          value: {
            tenant: parsed.value,
            issuedAt: "2026-08-29T11:45:00.000Z",
            expiresAt: "2026-08-29T12:15:00.000Z",
          },
        }
      : { ok: false, error: { kind: "signature-invalid" } };
  },
};

function namespace(id: string) {
  const claim = verifyTenantClaim(id, { verifier, now: NOW });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

const ACME = namespace("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const GLOBEX = namespace("t_02jd7k9h2m4n6p8r0s2t4v6x8z");
const MODEL = "frontier-1.5-20260801";
const PROMPT = "What is the refund window?";

test("a byte-identical prompt hits", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT, digest), ACME, await seal("Thirty days."));
  expect(cache.get(cacheKeyFor(ACME, MODEL, PROMPT, digest))).toBeDefined();
});

test("a one-character difference MISSES — this is exact match, not similarity", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT, digest), ACME, await seal("Thirty days."));
  expect(cache.get(cacheKeyFor(ACME, MODEL, "What is the refund window!", digest))).toBeUndefined();
});

test("the same prompt under a different model misses", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT, digest), ACME, await seal("Thirty days."));
  expect(cache.get(cacheKeyFor(ACME, "small-1.0-20260801", PROMPT, digest))).toBeUndefined();
});

test("one tenant never reads another tenant's cached answer", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT, digest), ACME, await seal("Thirty days."));
  expect(cache.get(cacheKeyFor(GLOBEX, MODEL, PROMPT, digest))).toBeUndefined();
});

test("invalidating one namespace leaves another intact", async () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT, digest), ACME, await seal("Thirty days."));
  cache.set(cacheKeyFor(GLOBEX, MODEL, PROMPT, digest), GLOBEX, await seal("Sixty days."));

  expect(cache.invalidateNamespace(ACME)).toBe(1);
  expect(cache.get(cacheKeyFor(ACME, MODEL, PROMPT, digest))).toBeUndefined();
  expect(cache.get(cacheKeyFor(GLOBEX, MODEL, PROMPT, digest))).toBeDefined();
});
