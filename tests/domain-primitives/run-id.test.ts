import { expect, test } from "bun:test";
import { generateRunId, parseRunId } from "@custodian/domain-primitives";

test("a generated run id satisfies the parser it ships beside", () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    expect(parseRunId(String(generateRunId())).ok).toBe(true);
  }
});

test("generated ids draw from the ambiguity-avoiding alphabet, and only from it", () => {
  // The characters, not just the pattern: the parser's [0-9a-z] accepts far more than the
  // generator should emit, so a move that silently swapped the alphabet passed every gate. Run
  // ids are read aloud and retyped during incidents, which is what i/l/o/u are excluded for.
  const seen = new Set<string>();
  for (let attempt = 0; attempt < 400; attempt += 1) {
    for (const character of String(generateRunId()).slice(2)) {
      seen.add(character);
    }
  }
  const expected = new Set("0123456789abcdefghjkmnpqrstvwxyz");
  expect([...seen].sort().join("")).toBe([...expected].sort().join(""));
});

test("ids are unique across draws", () => {
  const ids = new Set<string>();
  for (let attempt = 0; attempt < 500; attempt += 1) {
    ids.add(String(generateRunId()));
  }
  expect(ids.size).toBe(500);
});
