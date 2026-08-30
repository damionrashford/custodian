import { err, ok, type Result } from "@custodian/domain-primitives";
import type {
  Claim,
  ClaimResult,
  IdempotencyFailure,
  IdempotencyStore,
  RecordedOutcome,
} from "../domain/idempotency-store";
import type { RequestHash } from "../domain/request-hash";

export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #claims = new Map<string, Claim>();
  readonly #onWrite: () => void;

  constructor(options: { readonly onWrite: () => void }) {
    this.#onWrite = options.onWrite;
  }

  claim(request: RequestHash, at: string): Promise<Result<ClaimResult, IdempotencyFailure>> {
    const existing = this.#claims.get(request);
    if (existing !== undefined) {
      return Promise.resolve(ok({ kind: "already-claimed", claim: existing }));
    }
    const claim: Claim = { request, claimedAt: at, outcome: undefined };
    this.#claims.set(request, claim);
    this.#onWrite();
    return Promise.resolve(ok({ kind: "claimed", claim }));
  }

  complete(
    request: RequestHash,
    outcome: RecordedOutcome,
  ): Promise<Result<Claim, IdempotencyFailure>> {
    const existing = this.#claims.get(request);
    if (existing === undefined) {
      return Promise.resolve(err({ kind: "unknown-claim", request }));
    }
    const completed: Claim = { ...existing, outcome };
    this.#claims.set(request, completed);
    return Promise.resolve(ok(completed));
  }
}
