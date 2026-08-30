/**
 * How an embedding is represented inside its sealed content.
 *
 * Encoder and decoder sit together so the two cannot drift: the sealed bytes are opaque to every
 * store that holds them, so a mismatch would surface as an index that silently returns nothing
 * rather than as a parse error anyone could trace.
 */
export function encodeEmbedding(embedding: readonly number[]): string {
  return JSON.stringify(embedding);
}

/** Unsealed bytes are untrusted input like any stored row; they cross a parser, not an assertion. */
export function decodeEmbedding(text: string): readonly number[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) {
    return undefined;
  }
  const numbers: number[] = [];
  for (const value of parsed) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    numbers.push(value);
  }
  return numbers;
}
