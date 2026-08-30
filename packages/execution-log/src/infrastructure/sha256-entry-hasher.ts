import type { EntryHasher } from "../domain/entry-hasher";

export class Sha256EntryHasher implements EntryHasher {
  hash(canonicalInput: string): string {
    return new Bun.CryptoHasher("sha256").update(canonicalInput).digest("hex");
  }
}
