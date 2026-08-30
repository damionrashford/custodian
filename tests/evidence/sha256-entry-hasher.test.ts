import { expect, test } from "bun:test";
import { Sha256ContentHasher } from "@custodian/evidence";

const hasher = new Sha256ContentHasher();

test("hashing is deterministic and 64 hex characters wide", () => {
  const first = hasher.hash("custodian");
  expect(first).toBe(hasher.hash("custodian"));
  expect(first).toMatch(/^[0-9a-f]{64}$/);
});

test("a one-character change produces a different digest", () => {
  expect(hasher.hash("custodian")).not.toBe(hasher.hash("custodiaN"));
});
