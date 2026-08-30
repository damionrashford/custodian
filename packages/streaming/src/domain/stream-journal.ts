import type { Result, SealedContent } from "@custodian/domain-primitives";
import type { RunId } from "@custodian/execution-log";

export type JournalFailure = { readonly kind: "unknown-run"; readonly runId: RunId };

/**
 * Chunks are SealedContent, never plaintext. A streamed completion is a completion — the model
 * echoing an address or an account number lands here verbatim — so the journal is a store holding
 * personal data and takes the same sealing rule as the log, the cache and the idempotency store.
 * The port carries the constraint so no adapter can be written that violates it.
 *
 * The named deliverable that makes resume real. SSE appears to solve resumption and does not:
 * EventSource reconnects using Last-Event-ID, but the generation state on the server is typically
 * gone, so a five-minute task dropping at minute four restarts from scratch and pays for the
 * compute twice (AI_Agent_Implementation_Plan_v2.txt:114).
 */
export interface StreamJournal {
  append(runId: RunId, chunk: SealedContent): Promise<Result<number, JournalFailure>>;
  since(runId: RunId, offset: number): Promise<Result<readonly SealedContent[], JournalFailure>>;
}

/**
 * CDNs buffer responses, which silently breaks streaming
 * (AI_Agent_Implementation_Plan_v2.txt:116). Set on every streaming route.
 */
export const STREAMING_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "no-store",
  "X-Accel-Buffering": "no",
};
