import {
  parseModelSnapshot,
  parsePrincipalId,
  parseProviderId,
  parsePromptVersion,
  parseRegion,
  parseSubjectId,
  parseTenantId,
  parseToolName,
  type ModelSnapshot,
  type Principal,
} from "@custodian/domain-primitives";
import { DEFAULT_LOOP_LIMITS } from "@custodian/agent-loop";
import type { PromptSnapshot, Registry } from "@custodian/config-registry";
import { AesGcmSubjectKeyStore } from "@custodian/crypto-shred";
import { Sha256ContentHasher, SqliteExecutionLogStore } from "@custodian/execution-log";
import { XaiModelProvider } from "@custodian/gateway";
import { InMemoryIdempotencyStore } from "@custodian/idempotency";
import {
  InMemoryVectorIndex,
  namespaceFor,
  verifyTenantClaim,
  type ClaimVerifier,
  type IndexedDocument,
} from "@custodian/knowledge-base";
import { priceCompletion, type PriceTable } from "@custodian/metering";
import { HashEmbedder } from "@custodian/retrieval";
import type { ProviderProfile } from "@custodian/routing";
import { InMemoryToolCatalogue, parseTaskClass } from "@custodian/tool-registry";
import { runAgent } from "./application/run-agent";
import { KbSearchTool, type KbDocument } from "./infrastructure/kb-search-tool";
import { runsHandler } from "./interface/http";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) {
    throw new Error(`composition: bad ${label}`);
  }
  return parsed.value;
}

function required(name: string): string {
  const value = Bun.env[name];
  if (value === undefined || value.length === 0) {
    console.error(`${name} is not set. Set it and start again.`);
    process.exit(1);
  }
  return value;
}

const hasher = new Sha256ContentHasher();
const model = must(parseModelSnapshot("grok-4.6-20260801"), "model snapshot");
const usEast = must(parseRegion("us-east-1"), "region");
const taskClass = must(parseTaskClass("kb-answer"), "task class");
const searchKb = must(parseToolName("search_kb"), "tool name");
const tenant = must(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "dev tenant");

const operator: Principal = {
  kind: "human",
  id: must(parsePrincipalId("p_operator"), "principal"),
  tenant,
};

const PROMPT_TEXT =
  "You are a careful assistant answering questions from this workspace's knowledge base. " +
  "Use the search_kb tool to find evidence before answering; answer only from retrieved evidence. " +
  'Reply with exactly one JSON object per turn: {"action":"use-tool","tool":"search_kb","arguments":{"query":"..."}} ' +
  'or {"action":"answer","text":"..."}.';

const snapshot: PromptSnapshot = {
  version: must(parsePromptVersion("pv_01jd7k9h2m4n6p8r0s2t4v6x8z"), "prompt version"),
  text: PROMPT_TEXT,
  model,
  parameters: { temperature: 0 },
  changeSource: "agent-runtime slice composition",
  rationale: "first end-to-end agent",
  evalPassCaret: 0,
  createdAt: new Date().toISOString(),
};

const registry: Registry = {
  versions: new Map([[snapshot.version, snapshot]]),
  labels: new Map([["production", snapshot.version]]),
};

/**
 * Honest profile: xAI processes and stores in the US, and zero retention is unverified for this
 * key, so the profile says false and the run requests requiresZeroRetention: false. An EU tenant
 * would be refused by the router — that refusal is the platform working, not a bug.
 */
const profile: ProviderProfile = {
  id: must(parseProviderId("xai-us"), "provider id"),
  processingRegion: usEast,
  storageRegion: usEast,
  zeroRetention: false,
  healthy: true,
};

const provider = new XaiModelProvider({
  id: profile.id,
  baseUrl: "https://api.x.ai/v1",
  apiKey: required("XAI_API_KEY"),
  reasoningEffort: "low",
});

const prices: PriceTable = new Map<
  ModelSnapshot,
  { inputMicrosPerToken: number; outputMicrosPerToken: number }
>([[model, { inputMicrosPerToken: 0.2, outputMicrosPerToken: 0.5 }]]);
const bootPrice = priceCompletion({ inputTokens: 1, outputTokens: 1 }, model, prices);
if (!bootPrice.ok) {
  console.error("The composed model has no price. Add it to the price table and start again.");
  process.exit(1);
}

const SEED_DOCUMENTS: readonly (readonly [string, KbDocument])[] = [
  [
    "kb-erasure",
    {
      text: "Custodian erases personal data by destroying the data subject's encryption key, so backups cannot resurrect erased data.",
      classification: "internal",
      provenance: "tenant-authored",
    },
  ],
  [
    "kb-log",
    {
      text: "Every agent run is recorded in a hash-chained execution log naming the principal, tenant, region, tools used, and cost.",
      classification: "internal",
      provenance: "tenant-authored",
    },
  ],
  [
    "kb-routing",
    {
      text: "Requests route only to model providers that process and store data in the tenant's region; with no eligible provider the request is refused.",
      classification: "internal",
      provenance: "tenant-authored",
    },
  ],
];

const embedder = new HashEmbedder();
const documents = new Map<string, KbDocument>(SEED_DOCUMENTS);
const indexed: IndexedDocument[] = [];

const verifier: ClaimVerifier = {
  // Dev verifier: accepts the shared-secret token and answers with the dev tenant on a fresh
  // 30-minute window. A signed-claim verifier replaces this the moment a second tenant exists.
  verify: (token: string) => {
    if (token !== required("CUSTODIAN_DEV_CLAIM_SECRET")) {
      return { ok: false, error: { kind: "signature-invalid" } };
    }
    const now = Date.now();
    return {
      ok: true,
      value: {
        tenant,
        issuedAt: new Date(now - 60_000).toISOString(),
        expiresAt: new Date(now + 29 * 60_000).toISOString(),
      },
    };
  },
};

const subject = must(
  parseSubjectId(Bun.env["CUSTODIAN_DEV_SUBJECT"] ?? "s_01jd7k9h2m4n6p8r0s2t4v6x8z"),
  "subject",
);

const catalogue = new InMemoryToolCatalogue({
  definitions: [
    {
      name: searchKb,
      summary: "Search the workspace knowledge base.",
      schema: '{"query":"string"}',
      serverId: "kb",
    },
  ],
  allowlists: new Map([[taskClass, [searchKb]]]),
});

const logStore = new SqliteExecutionLogStore(
  Bun.env["CUSTODIAN_LOG_DB"] ?? "custodian-log.sqlite",
  hasher,
);

async function main(): Promise<void> {
  // The seed namespace is derived exactly the way every query derives it: verify the dev claim,
  // then namespaceFor — there is no other constructor, and that is the point.
  const bootClaim = verifyTenantClaim(required("CUSTODIAN_DEV_CLAIM_SECRET"), {
    verifier,
    now: new Date(),
  });
  if (!bootClaim.ok) {
    console.error("The dev claim secret did not verify at boot.");
    process.exit(1);
  }
  const seedNamespace = namespaceFor(bootClaim.value);

  for (const [documentId, document] of SEED_DOCUMENTS) {
    const embedded = await embedder.embed(document.text);
    if (!embedded.ok) {
      console.error("Seeding the knowledge base failed. Start again.");
      process.exit(1);
    }
    indexed.push({ namespace: seedNamespace, documentId, embedding: embedded.value });
  }

  const index = new InMemoryVectorIndex(indexed);
  const tool = new KbSearchTool({ name: searchKb, embedder, index, documents, topK: 4 });

  const handler = runsHandler({
    run: (request) =>
      runAgent(request, {
        registry,
        catalogue,
        tools: [tool],
        classifiers: [],
        logStore,
        candidates: [profile],
        providers: [provider],
        idempotency: new InMemoryIdempotencyStore({ onWrite: () => undefined }),
        keys: new AesGcmSubjectKeyStore({ now: () => new Date() }),
        hasher,
        costMicros: (usage) => {
          const priced = priceCompletion(usage, model, prices);
          if (!priced.ok) {
            throw new Error("composed model lost its price");
          }
          return priced.value;
        },
      }),
    verifier,
    now: () => new Date(),
    principal: operator,
    subject,
    tenantRegion: usEast,
    legalBasisPolicy: "tenant-contract",
    requiresZeroRetention: false,
    deployment: "production",
    taskClass,
    limits: DEFAULT_LOOP_LIMITS,
    maxOutputTokens: 600,
    jitter: 0.2,
  });

  const server = Bun.serve({
    port: Number(Bun.env["PORT"] ?? "8787"),
    routes: { "/runs": { POST: handler } },
  });
  console.log(`agent runtime listening on :${String(server.port)}`);

  process.on("SIGTERM", () => {
    void server.stop().then(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    void server.stop().then(() => process.exit(0));
  });
}

void main();
