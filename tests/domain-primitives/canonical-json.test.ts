import { expect, test } from "bun:test";
import { canonicalJson } from "@custodian/domain-primitives";

test("key insertion order does not change the serialisation", () => {
  expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
});

test("nested objects are ordered at every depth", () => {
  expect(canonicalJson({ outer: { z: 1, a: 2 } })).toBe('{"outer":{"a":2,"z":1}}');
});

test("arrays keep their order", () => {
  expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
});

test("undefined serialises to null rather than disappearing", () => {
  expect(canonicalJson(undefined)).toBe("null");
});
