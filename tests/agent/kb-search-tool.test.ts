import { expect, test } from "bun:test";
import { parseTenantId, parseToolName, type Namespace } from "@custodian/primitives";
import type { Embedder } from "@custodian/knowledge";
import {
  namespaceFor,
  verifyTenantClaim,
  type ClaimVerifier,
  type VectorIndex,
} from "@custodian/knowledge";
import { kbDocumentKey, KbSearchTool, type KbDocument } from "@custodian/agent";

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
  const claim = verifyTenantClaim("signed", {
    verifier,
    now: new Date("2026-08-30T00:00:00.000Z"),
  });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

function namespace(): Namespace {
  return namespaceOf("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
}

const embedder: Embedder = {
  embed: () => Promise.resolve({ ok: true, value: [1, 0, 0] }),
};

function indexReturning(ids: readonly string[]): VectorIndex {
  return {
    query: (query) =>
      Promise.resolve({
        ok: true,
        value: ids.map((documentId) => ({ namespace: query.namespace, documentId, score: 1 })),
      }),
  };
}

const documents = new Map<string, KbDocument>([
  [
    kbDocumentKey(namespace(), "doc-1"),
    {
      text: "Custodian crypto-shreds on erasure.",
      classification: "internal",
      provenance: "tenant-authored",
    },
  ],
]);

function tool(index: VectorIndex): KbSearchTool {
  return new KbSearchTool({
    name: must(parseToolName("search_kb"), "tool"),
    embedder,
    index,
    documents,
    topK: 4,
  });
}

test("a query maps matches through the document map into retrieved records", async () => {
  const executed = await tool(indexReturning(["doc-1"])).execute(
    '{"query":"erasure"}',
    namespace(),
  );
  expect(executed).toEqual({
    ok: true,
    value: {
      observation: "",
      retrieved: [
        {
          recordId: "doc-1",
          classification: "internal",
          provenance: "tenant-authored",
          text: "Custodian crypto-shreds on erasure.",
        },
      ],
    },
  });
});

test("a match whose document is unknown is skipped, not a crash", async () => {
  const executed = await tool(indexReturning(["doc-1", "ghost"])).execute(
    '{"query":"x"}',
    namespace(),
  );
  if (!executed.ok) throw new Error("execute failed");
  expect(executed.value.retrieved).toHaveLength(1);
});

test("no matches yields an honest empty observation", async () => {
  const executed = await tool(indexReturning([])).execute('{"query":"nothing"}', namespace());
  if (!executed.ok) throw new Error("execute failed");
  expect(executed.value.retrieved).toEqual([]);
  expect(executed.value.observation).toBe("No matching records.");
});

test("missing or wrong-shaped arguments are invalid-arguments", async () => {
  expect((await tool(indexReturning([])).execute("not json", namespace())).ok).toBe(false);
  expect((await tool(indexReturning([])).execute('{"q":"wrong-key"}', namespace())).ok).toBe(false);
  expect((await tool(indexReturning([])).execute('{"query":""}', namespace())).ok).toBe(false);
});

test("an index failure is execution-failed with only a kind, no internals", async () => {
  const failing: VectorIndex = {
    query: () =>
      Promise.resolve({
        ok: false,
        error: { kind: "index-unavailable", reason: "pinecone shard 7 timed out at 10.0.3.2" },
      }),
  };
  const executed = await tool(failing).execute('{"query":"x"}', namespace());
  expect(executed.ok).toBe(false);
  if (executed.ok) return;
  expect(executed.error).toEqual({ kind: "execution-failed", reason: "index-unavailable" });
});

test("two tenants using the same document id each get their own text", async () => {
  // Document ids are tenant-chosen and unique only within a namespace. Keyed by bare id, the
  // second tenant's text would overwrite the first's and be served to whoever asked.
  const acme = namespaceOf("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
  const other = namespaceOf("t_02jd7k9h2m4n6p8r0s2t4v6x8z");
  const shared = new Map<string, KbDocument>([
    [
      kbDocumentKey(acme, "doc-1"),
      { text: "ACME's own note.", classification: "internal", provenance: "tenant-authored" },
    ],
    [
      kbDocumentKey(other, "doc-1"),
      { text: "OTHER's own note.", classification: "internal", provenance: "tenant-authored" },
    ],
  ]);
  const search = new KbSearchTool({
    name: must(parseToolName("search_kb"), "tool"),
    embedder,
    index: indexReturning(["doc-1"]),
    documents: shared,
    topK: 4,
  });

  const forAcme = await search.execute('{"query":"note"}', acme);
  const forOther = await search.execute('{"query":"note"}', other);
  if (!forAcme.ok || !forOther.ok) throw new Error("execute failed");
  expect(forAcme.value.retrieved[0]?.text).toBe("ACME's own note.");
  expect(forOther.value.retrieved[0]?.text).toBe("OTHER's own note.");
});
