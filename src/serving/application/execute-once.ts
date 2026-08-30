import { err, ok, type Namespace, type Result } from "@custodian/primitives";
import type {
  IdempotencyFailure,
  IdempotencyStore,
  RecordedOutcome,
} from "../domain/idempotency-store";
import type { RequestHash } from "../domain/request-hash";

export type ExecuteOnceRequest = {
  readonly store: IdempotencyStore;
  readonly namespace: Namespace;
  readonly request: RequestHash;
  readonly at: string;
  readonly invoke: () => Promise<RecordedOutcome>;
};

/**
 * The claim is written before `invoke` runs, so dedupe happens before failover fires. A retry on a
 * flaky call double-charges the user otherwise, and once that happens the cost dashboard silently
 * lies too (AI_Agent_Implementation_Plan.txt:26-27).
 */
export async function executeOnce(
  request: ExecuteOnceRequest,
): Promise<Result<RecordedOutcome, IdempotencyFailure>> {
  const claimed = await request.store.claim(request.namespace, request.request, request.at);
  if (!claimed.ok) {
    return claimed;
  }

  if (claimed.value.kind === "already-claimed") {
    const recorded = claimed.value.claim.outcome;
    return recorded === undefined
      ? err({ kind: "in-flight", request: request.request })
      : ok(recorded);
  }

  const outcome = await request.invoke();
  const completed = await request.store.complete(request.namespace, request.request, outcome);
  return completed.ok ? ok(outcome) : completed;
}
