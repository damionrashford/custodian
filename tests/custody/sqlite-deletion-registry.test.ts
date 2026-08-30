import { expect, test } from "bun:test";
import { SqliteDeletionRegistry, subjectKeyName, type CustodyKeyName } from "@custodian/custody";
import { parseSubjectId, type ErasureProof } from "@custodian/primitives";

const SUBJECT = "s_01jd7k9h2m4n6p8r0s2t4v6x8z";

function name(): CustodyKeyName {
  const parsed = parseSubjectId(SUBJECT);
  if (!parsed.ok) {
    throw new Error("fixture did not parse");
  }
  return subjectKeyName(parsed.value);
}

const PROOF: ErasureProof = {
  target: `subject-${SUBJECT}`,
  destroyedAt: "2026-08-30T00:00:00.000Z",
  keyReference: `vault:transit/keys/subject-${SUBJECT}`,
  recordId: "d3f1c0a2-0000-4000-8000-000000000000",
  attestation: "external",
};

function temporaryPath(): string {
  return `${process.env["TMPDIR"] ?? "/tmp"}/custodian-registry-${String(Bun.nanoseconds())}.sqlite`;
}

test("a proof survives the process that wrote it", () => {
  const path = temporaryPath();
  const first = new SqliteDeletionRegistry(path);
  first.record(name(), PROOF);
  first.close();

  // The point of the table. Held in process, a restart loses the proof, and the next erasure request
  // for an already-erased subject mints a fresh one — truthful about the outcome, wrong about when,
  // and a second record of a single destruction in the audit trail.
  const second = new SqliteDeletionRegistry(path);
  expect(second.lookup(name())).toEqual(PROOF);
  second.close();
});

test("the first proof wins", () => {
  const registry = new SqliteDeletionRegistry(":memory:");
  registry.record(name(), PROOF);
  registry.record(name(), { ...PROOF, destroyedAt: "2026-12-25T00:00:00.000Z" });

  // A later destroy of the same key must not overwrite the timestamp the original destruction
  // actually happened at — that timestamp is the evidence.
  expect(registry.lookup(name())?.destroyedAt).toBe(PROOF.destroyedAt);
  registry.close();
});

test("an unrecorded key has no proof", () => {
  const registry = new SqliteDeletionRegistry(":memory:");
  expect(registry.lookup(name())).toBeUndefined();
  registry.close();
});

test("a proof is disposed of once the evidence window has passed", () => {
  const registry = new SqliteDeletionRegistry(":memory:");
  registry.record(name(), PROOF);

  // Two years and a day after the destruction it recorded. The registry is the one location an
  // erasure writes to rather than clears, so it is disposed of by the clock instead — on the same
  // window the execution log's metadata uses, because it is evidence of the same kind.
  const wellAfter = "2028-08-31T00:00:00.000Z";
  expect(registry.disposeExpired(wellAfter)).toBe(1);
  expect(registry.lookup(name())).toBeUndefined();
  registry.close();
});

test("a proof inside the evidence window is not disposed of", () => {
  const registry = new SqliteDeletionRegistry(":memory:");
  registry.record(name(), PROOF);

  // A sweep that dropped this would destroy the proof the erasure exists to produce, and the
  // erasure would become unprovable at exactly the moment a regulator asked.
  expect(registry.disposeExpired("2027-08-30T00:00:00.000Z")).toBe(0);
  expect(registry.lookup(name())).toEqual(PROOF);
  registry.close();
});
