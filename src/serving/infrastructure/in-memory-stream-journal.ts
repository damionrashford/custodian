import { err, ok, type Result, type RunId, type SealedContent } from "@custodian/primitives";
import type { JournalFailure, StreamJournal } from "../domain/stream-journal";

export class InMemoryStreamJournal implements StreamJournal {
  readonly #chunks = new Map<string, SealedContent[]>();

  append(runId: RunId, chunk: SealedContent): Promise<Result<number, JournalFailure>> {
    const existing = this.#chunks.get(runId);
    if (existing === undefined) {
      this.#chunks.set(runId, [chunk]);
      return Promise.resolve(ok(0));
    }
    existing.push(chunk);
    return Promise.resolve(ok(existing.length - 1));
  }

  since(runId: RunId, offset: number): Promise<Result<readonly SealedContent[], JournalFailure>> {
    const existing = this.#chunks.get(runId);
    return Promise.resolve(
      existing === undefined ? err({ kind: "unknown-run", runId }) : ok(existing.slice(offset)),
    );
  }
}
