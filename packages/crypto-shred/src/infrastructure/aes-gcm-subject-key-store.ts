import {
  type ErasureProof,
  err,
  type KeyStoreFailure,
  ok,
  type RetentionBucket,
  type Result,
  type SealedContent,
  type SubjectId,
} from "@custodian/domain-primitives";
import type { SealRequest, SubjectKeyStore } from "../domain/subject-key-store";

const IV_BYTES = 12;

/**
 * Reference adapter. Keys live in process, which is correct for tests and for the erasure
 * acceptance gate; the production adapter wraps each key under a KMS key-encryption key and the
 * KMS destruction record becomes the ErasureProof. The observable contract is identical, which is
 * the point of the port.
 */
export class AesGcmSubjectKeyStore implements SubjectKeyStore {
  readonly #subjectKeys = new Map<string, CryptoKey>();
  readonly #bucketKeys = new Map<string, CryptoKey>();
  readonly #proofs = new Map<string, ErasureProof>();
  readonly #now: () => Date;

  constructor(options: { readonly now: () => Date }) {
    this.#now = options.now;
  }

  async seal(request: SealRequest): Promise<Result<SealedContent, KeyStoreFailure>> {
    const subjectKey = await this.#keyFor(this.#subjectKeys, request.subject);
    const bucketKey = await this.#keyFor(this.#bucketKeys, request.bucket);

    const inner = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const outer = crypto.getRandomValues(new Uint8Array(IV_BYTES));

    const once = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: inner },
      subjectKey,
      new TextEncoder().encode(request.plaintext),
    );
    const twice = await crypto.subtle.encrypt({ name: "AES-GCM", iv: outer }, bucketKey, once);

    return ok({
      subject: request.subject,
      bucket: request.bucket,
      iv: `${toBase64(inner)}.${toBase64(outer)}`,
      ciphertext: toBase64(new Uint8Array(twice)),
    });
  }

  async unseal(sealed: SealedContent): Promise<Result<string, KeyStoreFailure>> {
    const subjectKey = this.#subjectKeys.get(sealed.subject);
    if (subjectKey === undefined) {
      return err({ kind: "subject-erased", subject: sealed.subject });
    }
    const bucketKey = this.#bucketKeys.get(sealed.bucket);
    if (bucketKey === undefined) {
      return err({ kind: "bucket-expired", bucket: sealed.bucket });
    }

    const [inner, outer] = sealed.iv.split(".");
    if (inner === undefined || outer === undefined) {
      return err({ kind: "ciphertext-corrupt" });
    }

    const once = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(outer) },
      bucketKey,
      fromBase64(sealed.ciphertext),
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(inner) },
      subjectKey,
      once,
    );
    return ok(new TextDecoder().decode(plaintext));
  }

  destroySubjectKey(subject: SubjectId): Promise<Result<ErasureProof, KeyStoreFailure>> {
    return Promise.resolve(ok(this.#destroy(this.#subjectKeys, subject, "subject")));
  }

  expireBucket(bucket: RetentionBucket): Promise<Result<ErasureProof, KeyStoreFailure>> {
    return Promise.resolve(ok(this.#destroy(this.#bucketKeys, bucket, "bucket")));
  }

  async #keyFor(keys: Map<string, CryptoKey>, id: string): Promise<CryptoKey> {
    const existing = keys.get(id);
    if (existing !== undefined) {
      return existing;
    }
    const created = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    keys.set(id, created);
    return created;
  }

  // Idempotent by contract: a repeat erasure request is a no-op returning the original proof
  // (Data_Protection_and_Retention.txt:94-96).
  #destroy(keys: Map<string, CryptoKey>, id: string, scope: string): ErasureProof {
    const existing = this.#proofs.get(id);
    if (existing !== undefined) {
      return existing;
    }
    keys.delete(id);
    const proof: ErasureProof = {
      target: id,
      destroyedAt: this.#now().toISOString(),
      keyReference: `local:${scope}:${id}`,
      recordId: crypto.randomUUID(),
      // This store destroyed the key and is now writing the record of having done so. That is
      // self-attestation, and naming it is what stops it being mistaken for the KMS record the
      // spec asks for. A KMS-backed adapter is what returns `external`.
      attestation: "self",
    };
    this.#proofs.set(id, proof);
    return proof;
  }
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  // Copy into a plain ArrayBuffer. Buffer is backed by ArrayBufferLike, which WebCrypto's
  // BufferSource rejects because that union admits SharedArrayBuffer.
  const decoded = Buffer.from(value, "base64");
  const bytes = new Uint8Array(new ArrayBuffer(decoded.byteLength));
  bytes.set(decoded);
  return bytes;
}
