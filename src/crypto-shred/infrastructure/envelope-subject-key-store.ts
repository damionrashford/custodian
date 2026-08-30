import {
  err,
  ok,
  type ErasureProof,
  type KeyStoreFailure,
  type RetentionBucket,
  type Result,
  type SealedContent,
  type SubjectId,
} from "@custodian/domain-primitives";
import type { DeletionRegistry } from "../domain/deletion-registry";
import {
  bucketKeyName,
  subjectKeyName,
  type CustodyKeyName,
  type KeyCustodian,
} from "../domain/key-custodian";
import type { SealRequest, SubjectKeyStore } from "../domain/subject-key-store";

const IV_BYTES = 12;

/**
 * Envelope encryption, as the corpus specifies it: a fresh content key per seal, wrapped by a
 * key-encryption key that lives in the KMS and never leaves it
 * (Data_Protection_and_Retention.txt:74). Only key material crosses the wire — the content is
 * encrypted here, so a large completion is not a large request to the KMS.
 *
 * Two envelopes rather than one, because the two destructions are independent: Article 17 erasure
 * destroys the subject KEK on request, the retention schedule destroys the bucket KEK on a clock,
 * and either alone must be sufficient to make the plaintext unrecoverable.
 */
export class EnvelopeSubjectKeyStore implements SubjectKeyStore {
  readonly #custodian: KeyCustodian;
  readonly #registry: DeletionRegistry;

  constructor(options: { readonly custodian: KeyCustodian; readonly registry: DeletionRegistry }) {
    this.#custodian = options.custodian;
    this.#registry = options.registry;
  }

  async seal(request: SealRequest): Promise<Result<SealedContent, KeyStoreFailure>> {
    const subjectKey = await this.#custodian.issueDataKey(subjectKeyName(request.subject));
    if (!subjectKey.ok) {
      return err(subjectKey.error);
    }
    const bucketKey = await this.#custodian.issueDataKey(bucketKeyName(request.bucket));
    if (!bucketKey.ok) {
      return err(bucketKey.error);
    }

    const inner = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const outer = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const once = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: inner },
      await importKey(subjectKey.value.plaintext),
      new TextEncoder().encode(request.plaintext),
    );
    const twice = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: outer },
      await importKey(bucketKey.value.plaintext),
      once,
    );

    return ok({
      subject: request.subject,
      bucket: request.bucket,
      iv: `${toBase64(inner)}.${toBase64(outer)}`,
      ciphertext: toBase64(new Uint8Array(twice)),
      wrappedSubjectKey: subjectKey.value.wrapped,
      wrappedBucketKey: bucketKey.value.wrapped,
    });
  }

  async unseal(sealed: SealedContent): Promise<Result<string, KeyStoreFailure>> {
    const [inner, outer] = sealed.iv.split(".");
    if (inner === undefined || outer === undefined) {
      return err({ kind: "ciphertext-corrupt" });
    }

    // Bucket first, mirroring the seal order. Reporting the subject failure for a bucket-expired
    // entry would tell a caller that a person had been erased when a retention period had merely
    // run — two facts with entirely different consequences.
    const bucketKey = await this.#custodian.unwrapDataKey(
      bucketKeyName(sealed.bucket),
      sealed.wrappedBucketKey,
    );
    if (!bucketKey.ok) {
      return err({ kind: "bucket-expired", bucket: sealed.bucket });
    }
    const subjectKey = await this.#custodian.unwrapDataKey(
      subjectKeyName(sealed.subject),
      sealed.wrappedSubjectKey,
    );
    if (!subjectKey.ok) {
      return err({ kind: "subject-erased", subject: sealed.subject });
    }

    try {
      const once = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(outer) },
        await importKey(bucketKey.value),
        fromBase64(sealed.ciphertext),
      );
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(inner) },
        await importKey(subjectKey.value),
        once,
      );
      return ok(new TextDecoder().decode(plaintext));
    } catch {
      return err({ kind: "ciphertext-corrupt" });
    }
  }

  destroySubjectKey(subject: SubjectId): Promise<Result<ErasureProof, KeyStoreFailure>> {
    return this.#destroy(subjectKeyName(subject));
  }

  expireBucket(bucket: RetentionBucket): Promise<Result<ErasureProof, KeyStoreFailure>> {
    return this.#destroy(bucketKeyName(bucket));
  }

  /**
   * Idempotent across restarts, because the registry outlives the process: "a repeat request is a
   * no-op returning the original proof" (Data_Protection_and_Retention.txt:95-96). Asking the KMS
   * again cannot satisfy that — the key is gone, so there is nothing there to answer with.
   */
  async #destroy(name: CustodyKeyName): Promise<Result<ErasureProof, KeyStoreFailure>> {
    const recorded = this.#registry.lookup(name);
    if (recorded !== undefined) {
      return ok(recorded);
    }
    const destroyed = await this.#custodian.destroyKey(name);
    if (!destroyed.ok) {
      return err(destroyed.error);
    }
    this.#registry.record(name, destroyed.value);
    return ok(destroyed.value);
  }
}

function importKey(raw: Uint8Array): Promise<CryptoKey> {
  // Copy into a plain ArrayBuffer. A Uint8Array may be backed by ArrayBufferLike, which WebCrypto's
  // BufferSource rejects because that union admits SharedArrayBuffer.
  const bytes = new Uint8Array(new ArrayBuffer(raw.byteLength));
  bytes.set(raw);
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const decoded = Buffer.from(value, "base64");
  const bytes = new Uint8Array(new ArrayBuffer(decoded.byteLength));
  bytes.set(decoded);
  return bytes;
}
