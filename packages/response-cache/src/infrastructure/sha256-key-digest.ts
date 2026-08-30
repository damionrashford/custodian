import type { KeyDigest } from "../domain/cache-key";

export class Sha256KeyDigest implements KeyDigest {
  digest(canonicalInput: string): string {
    return new Bun.CryptoHasher("sha256").update(canonicalInput).digest("hex");
  }
}
