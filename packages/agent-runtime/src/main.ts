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
import { PhraseInjectionClassifier } from "@custodian/guardrails";
import { InMemoryIdempotencyStore } from "@custodian/idempotency";
import {
  MAX_CLAIM_LIFETIME_MS,
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
import { kbDocumentKey, KbSearchTool, type KbDocument } from "./infrastructure/kb-search-tool";
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
  modelIds: new Map([[model, "grok-4.6"]]),
  reasoningEffort: "low",
  timeoutMs: 60_000,
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

const devClaimSecret = required("CUSTODIAN_DEV_CLAIM_SECRET");

/**
 * Local single-tenant development only, and it must not outlive that: the secret is a bearer
 * string with no signature and no expiry of its own, so every presentation mints a fresh window
 * and a leaked secret is an unexpiring credential — the shape LD-7 exists to refuse. What applies
 * here is the lifetime bound (derived below from the locked constant, never re-declared); what
 * does not yet apply is the signature, and that is the gap. Replace with an asymmetric verifier
 * that carries the tenant inside the signed payload before a second tenant exists.
 */
const verifier: ClaimVerifier = {
  verify: (token: string) => {
    if (token !== devClaimSecret) {
      return { ok: false, error: { kind: "signature-invalid" } };
    }
    const now = Date.now();
    return {
      ok: true,
      value: {
        tenant,
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + MAX_CLAIM_LIFETIME_MS / 2).toISOString(),
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

/**
 * Process-scoped, beside the durable log — never per request. Built inside the request closure,
 * the key store's DEKs died with the request that made them, leaving sealed content on disk that
 * no erasure could prove destroyed and no investigation could ever read; and a fresh claims map
 * per delivery made the redelivery defence unable to see a redelivery. Both are still in-memory,
 * so both still end at process exit — durable adapters are the next increment, and until then a
 * restart is a key destruction that no one requested.
 */
const keys = new AesGcmSubjectKeyStore({ now: () => new Date() });
const idempotency = new InMemoryIdempotencyStore({ onWrite: () => undefined });

async function main(): Promise<void> {
  // The seed namespace is derived exactly the way every query derives it: verify the dev claim,
  // then namespaceFor — there is no other constructor, and that is the point.
  const bootClaim = verifyTenantClaim(devClaimSecret, {
    verifier,
    now: new Date(),
  });
  if (!bootClaim.ok) {
    console.error("The dev claim secret did not verify at boot.");
    process.exit(1);
  }
  const seedNamespace = namespaceFor(bootClaim.value);

  const embeddings = await Promise.all(
    SEED_DOCUMENTS.map(([, document]) => embedder.embed(document.text)),
  );
  const indexed: IndexedDocument[] = [];
  const documents = new Map<string, KbDocument>();
  for (const [position, [documentId, document]] of SEED_DOCUMENTS.entries()) {
    const embedded = embeddings[position];
    if (embedded === undefined || !embedded.ok) {
      console.error("Seeding the knowledge base failed. Start again.");
      process.exit(1);
    }
    indexed.push({ namespace: seedNamespace, documentId, embedding: embedded.value });
    documents.set(kbDocumentKey(seedNamespace, documentId), document);
  }

  const index = new InMemoryVectorIndex(indexed);
  const tool = new KbSearchTool({ name: searchKb, embedder, index, documents, topK: 4 });

  const handler = runsHandler({
    run: (request) =>
      runAgent(request, {
        registry,
        catalogue,
        tools: [tool],
        // A rail with no classifier admits everything; an empty list here would make the screening
        // the changelog claims a gate that never fires (LD-2).
        classifiers: [new PhraseInjectionClassifier()],
        logStore,
        candidates: [profile],
        providers: [provider],
        idempotency,
        keys,
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
    // A run is several sequential provider calls and writes nothing until it answers, so the 10s
    // default closes the connection on a working run while the loop keeps spending.
    idleTimeout: 255,
    routes: { "/runs": { POST: handler } },
  });
  console.log(`agent runtime listening on :${String(server.port)}`);

  // In-flight runs finish first, then the evidence store's handle is released — closing the log
  // out from under a run still writing to it would lose the tail of exactly the record that run
  // exists to leave behind.
  const shutdown = (): void => {
    void server.stop().then(() => {
      logStore.close();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main();
