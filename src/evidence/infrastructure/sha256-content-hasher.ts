import type { ContentHasher } from "@custodian/primitives";

export class Sha256ContentHasher implements ContentHasher {
  hash(canonicalInput: string): string {
    return new Bun.CryptoHasher("sha256").update(canonicalInput).digest("hex");
  }
}
