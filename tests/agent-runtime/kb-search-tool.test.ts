import { expect, test } from "bun:test";
import { parseTenantId, parseToolName, type Namespace } from "@custodian/domain-primitives";
import type { Embedder } from "@custodian/retrieval";
import {
  namespaceFor,
  verifyTenantClaim,
  type ClaimVerifier,
  type VectorIndex,
} from "@custodian/knowledge-base";
import { KbSearchTool, type KbDocument } from "@custodian/agent-runtime";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

function namespace(): Namespace {
  const tenant = must(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
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
    "doc-1",
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
