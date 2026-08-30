import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { parseRunId, parseTenantId, type Namespace } from "@custodian/domain-primitives";
import {
  appendEntry,
  SqliteExecutionLogStore,
  Sha256ContentHasher,
  verifyRunLog,
  type LoggedEntry,
} from "@custodian/execution-log";
import { expiresAtForDuration } from "@custodian/retention";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge-base";

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

function storePath(): string {
  return join(mkdtempSync(join(tmpdir(), "custodian-log-")), "log.sqlite");
}

test("entries survive the process: a second store on the same file reads them back", async () => {
  const path = storePath();
  const log = logOf(3);
  await new SqliteExecutionLogStore(path, hasher).append(ACME, runId(), log);

  const reopened = new SqliteExecutionLogStore(path, hasher);
  expect(await reopened.read(ACME, runId())).toEqual({ ok: true, value: log });
});

test("appending the whole run twice stores each entry once", async () => {
  const store = new SqliteExecutionLogStore(storePath(), hasher);
  const log = logOf(3);
  expect(await store.append(ACME, runId(), log.slice(0, 2))).toEqual({
    ok: true,
    value: undefined,
  });
  expect(await store.append(ACME, runId(), log)).toEqual({ ok: true, value: undefined });
  expect(await store.read(ACME, runId())).toEqual({ ok: true, value: log });
});

test("a shortened log is refused across a reopen, not just within a process", async () => {
  const path = storePath();
  const log = logOf(3);
  await new SqliteExecutionLogStore(path, hasher).append(ACME, runId(), log);

  const reopened = new SqliteExecutionLogStore(path, hasher);
  expect(await reopened.append(ACME, runId(), log.slice(0, 2))).toEqual({
    ok: false,
    error: { kind: "sequence-rewind", tail: 2, received: 1 },
  });
  expect(await reopened.read(ACME, runId())).toEqual({ ok: true, value: log });
});

test("a diverging chain is refused across a reopen", async () => {
  const path = storePath();
  await new SqliteExecutionLogStore(path, hasher).append(ACME, runId(), logOf(2));

  const forged = logOf(3, "2026-08-30T00:00:00.000Z");
  const reopened = new SqliteExecutionLogStore(path, hasher);
  const outcome = await reopened.append(ACME, runId(), forged);
  expect(outcome.ok).toBe(false);
  if (outcome.ok) return;
  expect(outcome.error.kind).toBe("chain-diverged");
});

test("a row edited underneath the store is a corrupt entry, never returned as data", async () => {
  const path = storePath();
  await new SqliteExecutionLogStore(path, hasher).append(ACME, runId(), logOf(2));

  // The idiomatic tamper (LD-11): an engineer with database access editing evidence in place —
  // exactly what "an audit log engineers can edit is not evidence" refuses to accept.
  const db = new Database(path);
  db.run("UPDATE entries SET entry = replace(entry, '\"allowed\"', '\"blocked\"') WHERE seq = 1");
  db.close();

  const reopened = new SqliteExecutionLogStore(path, hasher);
  expect(await reopened.read(ACME, runId())).toEqual({
    ok: false,
    error: { kind: "corrupt-entry", runId: runId(), seq: 1 },
  });
});

test("an untampered read still verifies as a chain end to end", async () => {
  const path = storePath();
  const log = logOf(3);
  await new SqliteExecutionLogStore(path, hasher).append(ACME, runId(), log);

  const read = await new SqliteExecutionLogStore(path, hasher).read(ACME, runId());
  if (!read.ok) throw new Error("read failed");
  expect(verifyRunLog(read.value, hasher).ok).toBe(true);
});

test("one tenant cannot read another tenant's run from the same file", async () => {
  const path = storePath();
  const store = new SqliteExecutionLogStore(path, hasher);
  await store.append(ACME, runId(), logOf(2));

  expect(await store.read(OTHER, runId())).toEqual({
    ok: false,
    error: { kind: "unknown-run", runId: runId() },
  });
});

test("the same run id under two namespaces is two runs, not one", async () => {
  const store = new SqliteExecutionLogStore(storePath(), hasher);
  await store.append(ACME, runId(), logOf(3));
  await store.append(OTHER, runId(), logOf(1));

  const acme = await store.read(ACME, runId());
  const other = await store.read(OTHER, runId());
  if (!acme.ok || !other.ok) throw new Error("read failed");
  expect(acme.value).toHaveLength(3);
  expect(other.value).toHaveLength(1);
});

test("a run older than the metadata retention period is disposed of; a younger one is not", async () => {
  const store = new SqliteExecutionLogStore(storePath(), hasher);
  const oldAt = "2024-08-01T00:00:00.000Z";
  await store.append(ACME, runId(), logOf(2, oldAt));
  await store.append(OTHER, runId(), logOf(2));

  // The boundary comes from the schedule, not from a number in this test (LD-9): dispose exactly
  // when the schedule says the old run expires, and assert the young run survives that instant.
  const dueAt = expiresAtForDuration("execution-log-metadata", oldAt);
  expect(await store.disposeExpiredRuns(dueAt)).toBe(1);

  expect((await store.read(ACME, runId())).ok).toBe(false);
  expect((await store.read(OTHER, runId())).ok).toBe(true);
});

test("disposal one millisecond before expiry disposes of nothing", async () => {
  const store = new SqliteExecutionLogStore(storePath(), hasher);
  const oldAt = "2024-08-01T00:00:00.000Z";
  await store.append(ACME, runId(), logOf(2, oldAt));

  const dueAt = expiresAtForDuration("execution-log-metadata", oldAt);
  const justBefore = new Date(Date.parse(dueAt) - 1).toISOString();
  expect(await store.disposeExpiredRuns(justBefore)).toBe(0);
  expect((await store.read(ACME, runId())).ok).toBe(true);
});

test("a row deleted underneath the store is reported, not returned as a shorter clean log", async () => {
  const path = storePath();
  await new SqliteExecutionLogStore(path, hasher).append(ACME, runId(), logOf(3));

  // The other idiomatic tamper (LD-11): deleting the incriminating entry. Every surviving row's
  // own hash still matches, so only chain verification on read can catch the excision.
  const db = new Database(path);
  db.run("DELETE FROM entries WHERE seq = 1");
  db.close();

  const read = await new SqliteExecutionLogStore(path, hasher).read(ACME, runId());
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.error.kind).toBe("corrupt-entry");
});

test("a row edited into invalid JSON is a corrupt entry, not a crash", async () => {
  const path = storePath();
  await new SqliteExecutionLogStore(path, hasher).append(ACME, runId(), logOf(2));

  const db = new Database(path);
  db.run("UPDATE entries SET entry = substr(entry, 2) WHERE seq = 1");
  db.close();

  expect(await new SqliteExecutionLogStore(path, hasher).read(ACME, runId())).toEqual({
    ok: false,
    error: { kind: "corrupt-entry", runId: runId(), seq: 1 },
  });
});

test("a disposed run cannot be resurrected by replaying its own log", async () => {
  const store = new SqliteExecutionLogStore(storePath(), hasher);
  const oldAt = "2024-08-01T00:00:00.000Z";
  const log = logOf(2, oldAt);
  await store.append(ACME, runId(), log);
  await store.disposeExpiredRuns(expiresAtForDuration("execution-log-metadata", oldAt));

  // A durable replay re-sending the genuine log would otherwise pass the genesis check and
  // re-persist metadata past its lawful lifetime.
  expect(await store.append(ACME, runId(), log)).toEqual({
    ok: false,
    error: { kind: "run-disposed", runId: runId() },
  });
});

test("a run with a deleted middle row is never disposed of — tampering is not buried", async () => {
  const path = storePath();
  const store = new SqliteExecutionLogStore(path, hasher);
  const oldAt = "2024-08-01T00:00:00.000Z";
  await store.append(ACME, runId(), logOf(3, oldAt));

  // Each surviving row's own hash still verifies after a deletion; only chain verification sees
  // the excision. Disposing this run would destroy the remaining evidence and tombstone the run,
  // hiding the tamper behind an apparently lawful retention sweep.
  const db = new Database(path);
  db.run("DELETE FROM entries WHERE seq = 1");
  db.close();

  const reopened = new SqliteExecutionLogStore(path, hasher);
  expect(await reopened.disposeExpiredRuns("2026-08-30T00:00:00.000Z")).toBe(0);
  const read = await reopened.read(ACME, runId());
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.error.kind).toBe("corrupt-entry");
});

test("a run whose timestamps cannot be verified is never disposed of", async () => {
  const path = storePath();
  const store = new SqliteExecutionLogStore(path, hasher);
  const oldAt = "2024-08-01T00:00:00.000Z";
  await store.append(ACME, runId(), logOf(2, oldAt));

  // Backdating a row is the laundering move: tamper, then let the retention sweep destroy the
  // evidence "lawfully". The sweep reads timestamps from hash-verified bytes, so a tampered run
  // stays in place as evidence instead of being reaped.
  const db = new Database(path);
  db.run("UPDATE entries SET entry = replace(entry, '2024-08-01', '2020-01-01')");
  db.close();

  const reopened = new SqliteExecutionLogStore(path, hasher);
  expect(await reopened.disposeExpiredRuns("2026-08-30T00:00:00.000Z")).toBe(0);
});

test("a closed store releases its file, and what it wrote is still readable", async () => {
  const path = storePath();
  const log = logOf(3);
  const store = new SqliteExecutionLogStore(path, hasher);
  await store.append(ACME, runId(), log);
  store.close();

  // Closing is a shutdown step, not a disposal one: the evidence survives it intact.
  expect(await new SqliteExecutionLogStore(path, hasher).read(ACME, runId())).toEqual({
    ok: true,
    value: log,
  });
});
