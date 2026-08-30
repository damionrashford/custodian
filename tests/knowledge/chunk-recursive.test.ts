import { expect, test } from "bun:test";
import {
  chunkRecursive,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OVERLAP_TOKENS,
  type ChunkingOptions,
} from "@custodian/knowledge";

/** A stand-in tokeniser: four characters per token, the usual English rule of thumb. */
const countTokens = (text: string) => Math.ceil(text.length / 4);

const options: ChunkingOptions = { maxTokens: 20, overlapTokens: 4, countTokens };

const DOCUMENT = [
  "Custodian is an autonomous agent platform.",
  "It logs every tool call and model call.",
  "Erasure destroys the key, never the row.",
  "Residency refuses rather than crossing a boundary.",
].join("\n\n");

test("no chunk exceeds the token budget", () => {
  for (const chunk of chunkRecursive(DOCUMENT, options)) {
    expect(chunk.tokenCount).toBeLessThanOrEqual(options.maxTokens);
  }
});

test("chunking is deterministic", () => {
  expect(chunkRecursive(DOCUMENT, options)).toEqual(chunkRecursive(DOCUMENT, options));
});

/** The longest string that is both a suffix of `before` and a prefix of `after`. */
function sharedBoundary(before: string, after: string): string {
  for (let take = Math.min(before.length, after.length); take > 0; take -= 1) {
    if (before.endsWith(after.slice(0, take))) return after.slice(0, take);
  }
  return "";
}

test("consecutive chunks overlap, so evidence split across a boundary is still retrievable", () => {
  const chunks = chunkRecursive(DOCUMENT, options);
  expect(chunks.length).toBeGreaterThan(1);

  const first = chunks[0];
  const second = chunks[1];
  if (first === undefined || second === undefined) throw new Error("expected two chunks");

  expect(sharedBoundary(first.text, second.text).length).toBeGreaterThan(0);
});

test("overlap of zero produces no repetition", () => {
  const chunks = chunkRecursive(DOCUMENT, { ...options, overlapTokens: 0 });
  expect(chunks.map((chunk) => chunk.text).join("")).toBe(DOCUMENT);
});

test("a document shorter than one chunk yields exactly one chunk", () => {
  const chunks = chunkRecursive("short", options);
  expect(chunks).toHaveLength(1);
  expect(chunks[0]?.text).toBe("short");
});

test("empty input yields no chunks rather than one empty chunk", () => {
  expect(chunkRecursive("", options)).toEqual([]);
});

test("a run of text with no separators still respects the budget", () => {
  const wall = "x".repeat(500);
  for (const chunk of chunkRecursive(wall, options)) {
    expect(chunk.tokenCount).toBeLessThanOrEqual(options.maxTokens);
  }
});

test("the documented baseline is 512 tokens with 50-100 overlap", () => {
  expect(DEFAULT_MAX_TOKENS).toBe(512);
  expect(DEFAULT_OVERLAP_TOKENS).toBeGreaterThanOrEqual(50);
  expect(DEFAULT_OVERLAP_TOKENS).toBeLessThanOrEqual(100);
});
