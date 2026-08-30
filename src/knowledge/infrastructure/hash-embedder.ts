import { ok, type Result } from "@custodian/primitives";
import type { Embedder, EmbeddingFailure } from "../domain/embedder";

const DIMENSIONS = 64;

/**
 * A deterministic character-trigram embedder for composition roots that need retrieval to *work*
 * before it needs to be *good* — retrieval quality is explicitly not what a deployment using this
 * adapter is claiming, and the backbone model has limited impact next to chunking anyway
 * (AI_Agent_Implementation_Plan_v2.txt:150). No network, no key, no clock: the same text embeds
 * to the same unit vector forever, which is also what makes it usable in offline tests.
 */
export class HashEmbedder implements Embedder {
  embed(text: string): Promise<Result<readonly number[], EmbeddingFailure>> {
    const counts = new Array<number>(DIMENSIONS).fill(0);
    const lowered = text.toLowerCase();
    for (let index = 0; index + 3 <= lowered.length; index += 1) {
      const trigram = lowered.slice(index, index + 3);
      let hash = 5381;
      for (const character of trigram) {
        hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
      }
      const bucket = hash % DIMENSIONS;
      const current = counts[bucket] ?? 0;
      counts[bucket] = current + 1;
    }
    const norm = Math.sqrt(counts.reduce((sum, count) => sum + count * count, 0));
    const unit = norm === 0 ? counts : counts.map((count) => count / norm);
    return Promise.resolve(ok(unit));
  }
}
