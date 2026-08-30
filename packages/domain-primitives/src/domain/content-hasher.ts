/**
 * The one way to hash in this codebase. Hashing needs a runtime primitive and the domain layer
 * imports none, so the capability is a port and infrastructure supplies it.
 *
 * This was previously two ports with identical adapters and different method names — the execution
 * log's `ContentHasher.hash` and the response cache's `KeyDigest.digest` — while a comment on the
 * second asserted they were the same shape.
 */
export interface ContentHasher {
  hash(canonicalInput: string): string;
}
