/**
 * Deterministic JSON with keys sorted at every depth. The execution log's hash chain is computed
 * over this output, so two structurally identical entries must serialise identically regardless of
 * property insertion order — otherwise integrity verification produces false positives.
 */
export function canonicalJson(value: unknown): string {
  // JSON.stringify is typed as returning `string` but returns undefined for exactly these three
  // inputs. Excluding them up front is honest to both the type and the runtime; a `?? "null"`
  // fallback afterwards reads as dead code to the compiler and to the linter.
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return "null";
  }
  return JSON.stringify(value, sortKeys);
}

function sortKeys(_key: string, member: unknown): unknown {
  if (member === null || typeof member !== "object" || Array.isArray(member)) {
    return member;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(member).sort()) {
    sorted[key] = Object.getOwnPropertyDescriptor(member, key)?.value;
  }
  return sorted;
}
