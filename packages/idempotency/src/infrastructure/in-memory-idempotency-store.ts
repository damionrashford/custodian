import { err, ok, type Namespace, type Result } from "@custodian/domain-primitives";
import {
  CLAIM_TTL_MS,
  isExpired,
  type Claim,
  type ClaimResult,
  type IdempotencyFailure,
  type IdempotencyStore,
  type RecordedOutcome,
} from "../domain/idempotency-store";
import type { RequestHash } from "../domain/request-hash";

/** A separator no namespace or hex digest can contain, so no two keys can collide by composition. */
const KEY_SEPARATOR = "\u0000";

export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #claims = new Map<string, Claim>();
  readonly #onWrite: () => void;

  constructor(options: { readonly onWrite: () => void }) {
    this.#onWrite = options.onWrite;
  }

  claim(
    namespace: Namespace,
    request: RequestHash,
    at: string,
  ): Promise<Result<ClaimResult, IdempotencyFailure>> {
    const key = keyFor(namespace, request);
    const existing = this.#claims.get(key);
    // An expired claim is not a claim. Treating it as one would dedupe a legitimate later request.
    if (existing !== undefined && !isExpired(existing, at)) {
      return Promise.resolve(ok({ kind: "already-claimed", claim: existing }));
    }
    const claim: Claim = {
      namespace,
      request,
      claimedAt: at,
      expiresAt: new Date(Date.parse(at) + CLAIM_TTL_MS).toISOString(),
      outcome: undefined,
    };
    this.#claims.set(key, claim);
    this.#onWrite();
    return Promise.resolve(ok({ kind: "claimed", claim }));
  }

  complete(
    namespace: Namespace,
    request: RequestHash,
    outcome: RecordedOutcome,
  ): Promise<Result<Claim, IdempotencyFailure>> {
    const key = keyFor(namespace, request);
    const existing = this.#claims.get(key);
    if (existing === undefined) {
      return Promise.resolve(err({ kind: "unknown-claim", request }));
    }
    const completed: Claim = { ...existing, outcome };
    this.#claims.set(key, completed);
    return Promise.resolve(ok(completed));
  }
}

function keyFor(namespace: Namespace, request: RequestHash): string {
  return `${namespace}${KEY_SEPARATOR}${request}`;
}
