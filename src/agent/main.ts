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
} from "@custodian/primitives";
import { DEFAULT_LOOP_LIMITS } from "./domain/loop-controls";
import type { PromptSnapshot, Registry } from "@custodian/governance";
import {
  EnvelopeSubjectKeyStore,
  HttpVaultTransport,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
  VaultTransitKeyCustodian,
  type KeyCustodian,
} from "@custodian/custody";
import { Sha256ContentHasher, SqliteExecutionLogStore } from "@custodian/evidence";
import { XaiModelProvider } from "@custodian/serving";
import { PhraseInjectionClassifier } from "./infrastructure/phrase-injection-classifier";
import { SqliteIdempotencyStore } from "@custodian/serving";
import {
  Ed25519ClaimVerifier,
  SqliteVectorIndex,
  parseKeyRing,
  namespaceFor,
  sealEmbedding,
  verifyTenantClaim,
  type IndexedDocument,
} from "@custodian/knowledge";
import { bucketFor } from "@custodian/primitives";
import { priceCompletion, type PriceTable } from "@custodian/evidence";
import { HashEmbedder } from "@custodian/knowledge";
import type { ProviderProfile } from "@custodian/serving";
import { parseTaskClass } from "./domain/task-class";
import { InMemoryToolCatalogue } from "./infrastructure/in-memory-tool-catalogue";
import { custodyDecision } from "./application/custody-decision";
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

/**
 * The claim is a signed JWT and the server holds only the public key, so it can check tenant
 * identity and cannot mint it. The shared secret this replaces made every party that could verify
 * a claim able to forge one, and a leak of it was an unexpiring credential — the shape LD-7 names.
 * The corpus specifies "a signed JWT claim carrying the tenant ID"
 * (AI_Agent_Implementation_Plan_v2.txt:156) but no algorithm or key distribution, so Ed25519 and
 * an issuer-held private key are decisions taken here. `scripts/mint-dev-claim.ts` mints both.
 *
 * A ring rather than a key, because rotation is otherwise a cutover that invalidates every claim in
 * flight. Adding the next key here is step one of three; the issuer switches to it second, and it
 * leaves the ring only once the longest live claim has expired (Gap_Register_v2.txt:272).
 */
const keyRing = parseKeyRing(required("CUSTODIAN_CLAIM_KEYS"));
if (!keyRing.ok) {
  console.error(
    `CUSTODIAN_CLAIM_KEYS is not a usable key ring (${keyRing.error.kind}). It is JSON mapping a ` +
      `signing key id to its SPKI PEM: {"claim-2026-08": "-----BEGIN PUBLIC KEY-----..."}. ` +
      `Mint one with scripts/mint-dev-claim.ts.`,
  );
  process.exit(1);
}
const verifier = new Ed25519ClaimVerifier(keyRing.value);

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
 * Where the subject keys live, decided from the environment.
 *
 * Durable ciphertext with ephemeral keys is worse than either alone: a restart leaves rows on disk
 * that nothing can ever decrypt, with no erasure request, no proof and no registry entry recording
 * that they became unrecoverable — and a later erasure would mint a proof truthful in outcome but
 * false about when. That is why the in-memory path still takes a deliberate acknowledgement, and why
 * a half-configured Vault refuses instead of quietly falling back to it.
 */
const custody = custodyDecision({
  vaultAddress: Bun.env["CUSTODIAN_VAULT_ADDR"],
  vaultToken: Bun.env["CUSTODIAN_VAULT_TOKEN"],
  devMode: Bun.env["CUSTODIAN_DEV_MODE"],
});

function custodianFrom(decision: typeof custody): KeyCustodian {
  switch (decision.kind) {
    case "vault":
      return new VaultTransitKeyCustodian({
        transport: new HttpVaultTransport({
          address: decision.address,
          token: decision.token,
          timeoutMs: 10_000,
        }),
        now: () => new Date(),
      });
    case "in-memory":
      console.error(
        "CUSTODIAN_DEV_MODE=1: subject keys are held in memory, so a restart destroys every key " +
          "and the sealed rows on disk become permanently unreadable. Development only.",
      );
      return new InMemoryKeyCustodian({ now: () => new Date() });
    case "refuse":
      console.error(
        "No key custodian is configured. Set CUSTODIAN_VAULT_ADDR and CUSTODIAN_VAULT_TOKEN " +
          "together, or set CUSTODIAN_DEV_MODE=1 to acknowledge in-memory keys.",
      );
      return process.exit(1);
    default:
      return decision;
  }
}

const deletionRegistry = new SqliteDeletionRegistry(
  Bun.env["CUSTODIAN_REGISTRY_DB"] ?? "custodian-registry.sqlite",
);
const keys = new EnvelopeSubjectKeyStore({
  custodian: custodianFrom(custody),
  registry: deletionRegistry,
});
const idempotency = new SqliteIdempotencyStore(
  Bun.env["CUSTODIAN_CLAIMS_DB"] ?? "custodian-claims.sqlite",
);

async function main(): Promise<void> {
  // The seed namespace is derived exactly the way every query derives it: verify the dev claim,
  // then namespaceFor — there is no other constructor, and that is the point. The consequence is
  // deliberate and worth knowing: a claim expires, so a restart more than its lifetime after
  // minting fails here rather than seeding from an unchecked identity. A production entry point
  // needs a boot path that mints its own, not a longer-lived token.
  const bootClaim = verifyTenantClaim(required("CUSTODIAN_DEV_CLAIM"), {
    verifier,
    now: new Date(),
  });
  if (!bootClaim.ok) {
    console.error("CUSTODIAN_DEV_CLAIM did not verify. Mint one with scripts/mint-dev-claim.ts.");
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
    // The embedding is sealed under the authoring subject's key, because the data map gives the
    // vector index one erasure mechanism and it is key destruction
    // (Data_Protection_and_Retention.txt:49-50). A bare vector would survive the subject's erasure.
    const sealed = await sealEmbedding(keys, {
      subject,
      bucket: bucketFor("prompts-and-completions", new Date().toISOString()),
      embedding: embedded.value,
    });
    if (!sealed.ok) {
      console.error("Sealing the seed embeddings failed. Start again.");
      process.exit(1);
    }
    indexed.push({ namespace: seedNamespace, documentId, embedding: sealed.value });
    documents.set(kbDocumentKey(seedNamespace, documentId), document);
  }

  // Durable, beside the execution log. In memory the index died with the process while the log did
  // not, so a run's logged retrieval cited a document nothing could produce again after a restart —
  // the evidence outliving the thing it points at.
  const index = new SqliteVectorIndex({
    path: Bun.env["CUSTODIAN_INDEX_DB"] ?? "custodian-index.sqlite",
    keys,
  });
  for (const document of indexed) {
    index.upsert(document);
  }
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
  // Retention is disposal on a schedule, a different obligation from erasure on request (LD-9):
  // sealing made these rows erasable, it did nothing about the ones nobody asks about. Hourly is
  // an operational cadence, not a retention period — the periods live in the schedule.
  const sweep = setInterval(
    () => {
      const now = new Date().toISOString();
      idempotency.sweepExpired(now);
      deletionRegistry.disposeExpired(now);
      void logStore.disposeExpiredRuns(now);
    },
    60 * 60 * 1000,
  );

  const shutdown = (): void => {
    clearInterval(sweep);
    void server.stop().then(() => {
      logStore.close();
      idempotency.close();
      deletionRegistry.close();
      index.close();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main();
