import { expect, test } from "bun:test";
import { parseRunId, parseTenantId, type Namespace } from "@custodian/primitives";
import {
  appendEntry,
  InMemoryExecutionLogStore,
  Sha256ContentHasher,
  type LoggedEntry,
} from "@custodian/evidence";
import { expiresAtForDuration } from "@custodian/primitives";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge";

const AT = "2026-08-29T00:00:00.000Z";
const hasher = new Sha256ContentHasher();

function runId() {
  const parsed = parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z");
  if (!parsed.ok) throw new Error("fixture: bad run id");
  return parsed.value;
}

function namespaceOf(id: string): Namespace {
  const tenant = parseTenantId(id);
  if (!tenant.ok) throw new Error("fixture: bad tenant");
  const verifier: ClaimVerifier = {
    verify: () => ({
      ok: true,
      value: {
        tenant: tenant.value,
        issuedAt: "2026-08-28T23:45:00.000Z",
        expiresAt: "2026-08-29T00:15:00.000Z",
      },
    }),
  };
  const claim = verifyTenantClaim("signed", { verifier, now: new Date(AT) });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

const ACME = namespaceOf("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const OTHER = namespaceOf("t_02jd7k9h2m4n6p8r0s2t4v6x8z");

function logOf(count: number, at: string = AT): readonly LoggedEntry[] {
  let log: readonly LoggedEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const appended = appendEntry(
      log,
      { kind: "guardrail-evaluated", policy: "p", rule: `r${String(index)}`, outcome: "allowed" },
      { runId: runId(), at, hasher },
    );
    if (!appended.ok) throw new Error("fixture: append failed");
    log = appended.value;
  }
  return log;
}

test("appending the whole run twice stores each entry once", async () => {
  const store = new InMemoryExecutionLogStore();
  const log = logOf(3);

  expect(await store.append(ACME, runId(), log.slice(0, 2))).toEqual({
    ok: true,
    value: undefined,
  });
  expect(await store.append(ACME, runId(), log)).toEqual({ ok: true, value: undefined });

  expect(await store.read(ACME, runId())).toEqual({ ok: true, value: log });
});

test("a shortened log is refused rather than merged", async () => {
  const store = new InMemoryExecutionLogStore();
  const log = logOf(3);
  await store.append(ACME, runId(), log);

  // Detection after the fact is not enough on its own — an audit log an engineer can edit is not
  // evidence, and verifyRunLog only reports the edit once it has already happened.
  expect(await store.append(ACME, runId(), log.slice(0, 2))).toEqual({
    ok: false,
    error: { kind: "sequence-rewind", tail: 2, received: 1 },
  });
  expect(await store.read(ACME, runId())).toEqual({ ok: true, value: log });
});

test("a rewritten prefix is refused, because the chain no longer continues the stored tail", async () => {
  const store = new InMemoryExecutionLogStore();
  await store.append(ACME, runId(), logOf(2));

  const forged = logOf(3);
  const tampered = [...forged.slice(0, 2), { ...forged[2], previousHash: "0".repeat(64) }];
  const outcome = await store.append(ACME, runId(), tampered as readonly LoggedEntry[]);

  expect(outcome.ok).toBe(false);
  if (outcome.ok) return;
  expect(outcome.error.kind).toBe("chain-diverged");
});

test("one tenant cannot read another tenant's run", async () => {
  const store = new InMemoryExecutionLogStore();
  await store.append(ACME, runId(), logOf(2));

  // A run identifier names a run belonging to exactly one tenant. An unscoped read would disclose
  // across tenants the very record that proves what was done with whose data.
  expect(await store.read(OTHER, runId())).toEqual({
    ok: false,
    error: { kind: "unknown-run", runId: runId() },
  });
});

test("the same run id under two namespaces is two runs, not one", async () => {
  const store = new InMemoryExecutionLogStore();
  await store.append(ACME, runId(), logOf(3));
  await store.append(OTHER, runId(), logOf(1));

  const acme = await store.read(ACME, runId());
  const other = await store.read(OTHER, runId());
  if (!acme.ok || !other.ok) throw new Error("read failed");
  expect(acme.value).toHaveLength(3);
  expect(other.value).toHaveLength(1);
});

test("disposal is part of the port: the in-memory adapter disposes and refuses resurrection too", async () => {
  const store = new InMemoryExecutionLogStore();
  const oldAt = "2024-08-01T00:00:00.000Z";
  const log = logOf(2, oldAt);
  await store.append(ACME, runId(), log);

  const dueAt = expiresAtForDuration("execution-log-metadata", oldAt);
  expect(await store.disposeExpiredRuns(dueAt)).toBe(1);
  expect((await store.read(ACME, runId())).ok).toBe(false);
  expect(await store.append(ACME, runId(), log)).toEqual({
    ok: false,
    error: { kind: "run-disposed", runId: runId() },
  });
});
