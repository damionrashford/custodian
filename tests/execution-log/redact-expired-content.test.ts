import { bucketFor } from "@custodian/retention";
import { expect, test } from "bun:test";
import {
  parsePrincipalId,
  parseRegion,
  type Principal,
  type Region,
  type TenantId,
  parseRunId,
  parseSubjectId,
  parseTenantId,
} from "@custodian/domain-primitives";
import {
  EnvelopeSubjectKeyStore,
  InMemoryKeyCustodian,
  SqliteDeletionRegistry,
} from "@custodian/crypto-shred";
import {
  appendEntry,
  redactExpiredContent,
  Sha256ContentHasher,
  verifyRunLog,
  type LoggedEntry,
} from "@custodian/execution-log";

function principal(tenant: TenantId): Principal {
  const id = parsePrincipalId("p_operator");
  if (!id.ok) throw new Error("fixture: bad principal");
  return { kind: "human", id: id.value, tenant };
}

function region(): Region {
  const parsed = parseRegion("eu-west-1");
  if (!parsed.ok) throw new Error("fixture: bad region");
  return parsed.value;
}

const hasher = new Sha256ContentHasher();

function parsedOrThrow<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

test("expiring a bucket removes the content and leaves the chain verifiable", async () => {
  const store = new EnvelopeSubjectKeyStore({
    custodian: new InMemoryKeyCustodian({ now: () => new Date("2026-09-28T00:00:00.000Z") }),
    registry: new SqliteDeletionRegistry(":memory:"),
  });
  const subject = parsedOrThrow(parseSubjectId("s_01jd7k9h2m4n6p8r0s2t4v6x8z"), "subject");
  const bucket = bucketFor("execution-log-content", "2026-08-29T00:00:00.000Z");
  const tenant = parsedOrThrow(parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z"), "tenant");
  const runId = parsedOrThrow(parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z"), "run");

  const sealed = await store.seal({ subject, bucket, plaintext: "what the user actually typed" });
  if (!sealed.ok) throw new Error("fixture: seal failed");

  const appended = appendEntry(
    [],
    {
      kind: "run-started",
      principal: principal(tenant),
      tenant,
      region: region(),
      legalBasisPolicy: "tenant-contract",
      request: sealed.value,
    },
    { runId, at: "2026-08-29T00:00:00.000Z", hasher },
  );
  if (!appended.ok) throw new Error("fixture: append failed");
  const log: readonly LoggedEntry[] = appended.value;

  const proof = await redactExpiredContent({
    store,
    writtenAt: "2026-08-29T00:00:00.000Z",
    now: "2026-10-01T00:00:00.000Z",
  });
  expect(proof.ok).toBe(true);

  expect(await store.unseal(sealed.value)).toEqual({
    ok: false,
    error: { kind: "bucket-expired", bucket },
  });

  // The record that the action occurred survives; only the content inside it is gone.
  expect(verifyRunLog(log, hasher).ok).toBe(true);
  expect(log[0]?.event.kind).toBe("run-started");
});

test("redaction before the period elapses is refused, not merely discouraged", async () => {
  const store = new EnvelopeSubjectKeyStore({
    custodian: new InMemoryKeyCustodian({ now: () => new Date("2026-08-29T00:00:00.000Z") }),
    registry: new SqliteDeletionRegistry(":memory:"),
  });

  // A caller passing its own bucket could destroy the Article 73 window on day one, and nothing at
  // the call site would show it. The period is a legal position, not a parameter (LD-9).
  const early = await redactExpiredContent({
    store,
    writtenAt: "2026-08-29T00:00:00.000Z",
    now: "2026-09-01T00:00:00.000Z",
  });

  expect(early).toEqual({
    ok: false,
    error: { kind: "not-yet-due", dueAt: "2026-09-28T00:00:00.000Z" },
  });
});
