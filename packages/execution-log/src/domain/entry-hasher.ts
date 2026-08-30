/**
 * Port. Hashing needs a runtime primitive, and the domain layer imports no runtime built-ins —
 * so the domain declares the capability and infrastructure supplies it.
 */
export interface EntryHasher {
  hash(canonicalInput: string): string;
}
