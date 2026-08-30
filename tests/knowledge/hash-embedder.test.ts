import { expect, test } from "bun:test";
import { HashEmbedder } from "@custodian/knowledge";

test("the same text always embeds to the same vector", async () => {
  const embedder = new HashEmbedder();
  const first = await embedder.embed("crypto-shred erasure");
  const second = await embedder.embed("crypto-shred erasure");
  expect(first).toEqual(second);
});

test("different texts embed to different vectors", async () => {
  const embedder = new HashEmbedder();
  const first = await embedder.embed("crypto-shred erasure");
  const second = await embedder.embed("token metering");
  if (!first.ok || !second.ok) throw new Error("embed failed");
  expect(first.value).not.toEqual(second.value);
});

test("vectors are unit-normalised, 64 dimensions", async () => {
  const embedder = new HashEmbedder();
  const embedded = await embedder.embed("observability");
  if (!embedded.ok) throw new Error("embed failed");
  expect(embedded.value).toHaveLength(64);
  const norm = Math.sqrt(embedded.value.reduce((sum, x) => sum + x * x, 0));
  expect(Math.abs(norm - 1)).toBeLessThan(1e-9);
});
