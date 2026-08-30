import { expect, test } from "bun:test";
import { sanitizeToolOutput } from "@custodian/identity";

const ESC = String.fromCodePoint(0x1b);
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068);

test("tool output is tagged untrusted, never as user input", () => {
  const sanitized = sanitizeToolOutput("ordinary result");
  expect(sanitized.provenance).toBe("tool-output");
  expect(sanitized.trust).toBe("untrusted");
});

// `String(...)` because `text` is branded UntrustedText and `toBe` is invariant — comparing it to
// a bare string literal is a type error, not a passing test.
test("ANSI escape sequences are stripped", () => {
  expect(String(sanitizeToolOutput(`${ESC}[31mred${ESC}[0m`).text)).toBe("red");
});

test("zero-width and bidirectional override characters are stripped", () => {
  const hostile = `safe${ZERO_WIDTH_SPACE}hidden${RIGHT_TO_LEFT_OVERRIDE}reversed${FIRST_STRONG_ISOLATE}`;
  expect(String(sanitizeToolOutput(hostile).text)).toBe("safehiddenreversed");
});

test("newlines and tabs survive", () => {
  expect(String(sanitizeToolOutput("line\n\tindented").text)).toBe("line\n\tindented");
});
