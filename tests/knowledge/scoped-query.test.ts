import { expect, test } from "bun:test";
import { parseTenantId } from "@custodian/primitives";
import {
  namespaceFor,
  scopedQuery,
  verifyTenantClaim,
  type ClaimVerifier,
} from "@custodian/knowledge";

const ACME = "t_01jd7k9h2m4n6p8r0s2t4v6x8z";
const GLOBEX = "t_02jd7k9h2m4n6p8r0s2t4v6x8z";

const NOW = new Date("2026-08-29T12:00:00.000Z");

/** Accepts a token of the form "signed:<tenantId>" and rejects everything else. */
const verifier: ClaimVerifier = {
  verify: (token) => {
    const [prefix, id] = token.split(":");
    if (prefix !== "signed" || id === undefined) {
      return { ok: false, error: { kind: "signature-invalid" } };
    }
    const parsed = parseTenantId(id);
    return parsed.ok
      ? {
          ok: true,
          value: {
            tenant: parsed.value,
            issuedAt: "2026-08-29T11:45:00.000Z",
            expiresAt: "2026-08-29T12:15:00.000Z",
          },
        }
      : { ok: false, error: { kind: "claim-malformed", received: id } };
  },
};

function claimFor(id: string) {
  const claim = verifyTenantClaim(`signed:${id}`, { verifier, now: NOW });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return claim.value;
}

test("a verified claim derives a namespace carrying its tenant", () => {
  expect(String(namespaceFor(claimFor(ACME)))).toBe(`tenant:${ACME}`);
});

test("two tenants never derive the same namespace", () => {
  expect(namespaceFor(claimFor(ACME))).not.toBe(namespaceFor(claimFor(GLOBEX)));
});

test("an unsigned token is rejected, so no namespace can be derived from it", () => {
  expect(verifyTenantClaim(`forged:${ACME}`, { verifier, now: NOW })).toEqual({
    ok: false,
    error: { kind: "signature-invalid" },
  });
});

test("a signed token carrying a malformed tenant is rejected", () => {
  expect(verifyTenantClaim("signed:acme-corp", { verifier, now: NOW })).toEqual({
    ok: false,
    error: { kind: "claim-malformed", received: "acme-corp" },
  });
});

test("a scoped query always carries the namespace derived from the claim", () => {
  const query = scopedQuery(claimFor(ACME), [0.1, 0.2], 5);
  expect(query.namespace).toBe(namespaceFor(claimFor(ACME)));
});

test("one tenant's query can never name another tenant's namespace", () => {
  const mine = scopedQuery(claimFor(ACME), [0.1], 5);
  const theirs = scopedQuery(claimFor(GLOBEX), [0.1], 5);

  expect(mine.namespace).not.toBe(theirs.namespace);
  expect(String(mine.namespace)).not.toContain(GLOBEX);
});

test("the package exposes no way to build a namespace from a raw string", async () => {
  const surface: Record<string, unknown> = await import("@custodian/knowledge");
  const constructors = Object.keys(surface).filter((key) =>
    /^(namespace|parseNamespace)/i.test(key),
  );
  expect(constructors).toEqual(["namespaceFor"]);
});
