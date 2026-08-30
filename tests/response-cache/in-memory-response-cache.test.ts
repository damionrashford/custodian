import { expect, test } from "bun:test";
import { parseTenantId } from "@custodian/domain-primitives";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge-base";
import { cacheKeyFor, InMemoryResponseCache } from "@custodian/response-cache";

const verifier: ClaimVerifier = {
  verify: (token) => {
    const parsed = parseTenantId(token);
    return parsed.ok ? parsed : { ok: false, error: { kind: "signature-invalid" } };
  },
};

function namespace(id: string) {
  const claim = verifyTenantClaim(id, verifier);
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

const ACME = namespace("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const GLOBEX = namespace("t_02jd7k9h2m4n6p8r0s2t4v6x8z");
const MODEL = "frontier-1.5-20260801";
const PROMPT = "What is the refund window?";

test("a byte-identical prompt hits", () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT), ACME, "Thirty days.");
  expect(cache.get(cacheKeyFor(ACME, MODEL, PROMPT))).toBe("Thirty days.");
});

test("a one-character difference MISSES — this is exact match, not similarity", () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT), ACME, "Thirty days.");
  expect(cache.get(cacheKeyFor(ACME, MODEL, "What is the refund window!"))).toBeUndefined();
});

test("the same prompt under a different model misses", () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT), ACME, "Thirty days.");
  expect(cache.get(cacheKeyFor(ACME, "small-1.0-20260801", PROMPT))).toBeUndefined();
});

test("one tenant never reads another tenant's cached answer", () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT), ACME, "Thirty days.");
  expect(cache.get(cacheKeyFor(GLOBEX, MODEL, PROMPT))).toBeUndefined();
});

test("invalidating one namespace leaves another intact", () => {
  const cache = new InMemoryResponseCache();
  cache.set(cacheKeyFor(ACME, MODEL, PROMPT), ACME, "Thirty days.");
  cache.set(cacheKeyFor(GLOBEX, MODEL, PROMPT), GLOBEX, "Sixty days.");

  expect(cache.invalidateNamespace(ACME)).toBe(1);
  expect(cache.get(cacheKeyFor(ACME, MODEL, PROMPT))).toBeUndefined();
  expect(cache.get(cacheKeyFor(GLOBEX, MODEL, PROMPT))).toBe("Sixty days.");
});
