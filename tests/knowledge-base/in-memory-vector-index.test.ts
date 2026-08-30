import { expect, test } from "bun:test";
import { parseTenantId, type Namespace } from "@custodian/domain-primitives";
import {
  InMemoryVectorIndex,
  namespaceFor,
  verifyTenantClaim,
  type ClaimVerifier,
} from "@custodian/knowledge-base";

const AT = new Date("2026-08-30T00:00:00.000Z");

function namespaceOf(id: string): Namespace {
  const tenant = parseTenantId(id);
  if (!tenant.ok) throw new Error("fixture: bad tenant");
  const verifier: ClaimVerifier = {
    verify: () => ({
      ok: true,
      value: {
        tenant: tenant.value,
        issuedAt: "2026-08-29T23:45:00.000Z",
        expiresAt: "2026-08-30T00:15:00.000Z",
      },
    }),
  };
  const claim = verifyTenantClaim("signed", { verifier, now: AT });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

const ACME = namespaceOf("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const OTHER = namespaceOf("t_02jd7k9h2m4n6p8r0s2t4v6x8z");

const index = new InMemoryVectorIndex([
  { namespace: ACME, documentId: "acme-1", embedding: [1, 0, 0] },
  { namespace: ACME, documentId: "acme-2", embedding: [0.9, 0.1, 0] },
  { namespace: OTHER, documentId: "other-1", embedding: [1, 0, 0] },
]);

test("a query never returns another namespace's documents, even at perfect similarity", async () => {
  const matches = await index.query({ namespace: ACME, embedding: [1, 0, 0], topK: 10 });
  if (!matches.ok) throw new Error("query failed");
  expect(matches.value.map((match) => match.documentId).sort()).toEqual(["acme-1", "acme-2"]);
});

test("topK bounds the result, best match first", async () => {
  const matches = await index.query({ namespace: ACME, embedding: [1, 0, 0], topK: 1 });
  if (!matches.ok) throw new Error("query failed");
  expect(matches.value.map((match) => match.documentId)).toEqual(["acme-1"]);
});

test("an empty namespace yields an empty result, not a failure", async () => {
  const empty = new InMemoryVectorIndex([]);
  const matches = await empty.query({ namespace: ACME, embedding: [1, 0, 0], topK: 3 });
  expect(matches).toEqual({ ok: true, value: [] });
});
