import {
  err,
  isRecord,
  ok,
  type ErasureProof,
  type KeyStoreFailure,
  type Result,
} from "@custodian/primitives";
import type { CustodyKeyName, DataKey, KeyCustodian } from "../domain/key-custodian";
import type { VaultResponse, VaultTransport } from "./vault-transport";

const DATA_KEY_BITS = 256;

/**
 * The statuses that mean the ciphertext genuinely cannot be opened, rather than that Vault could
 * not be asked. Transit answers 400 both for a key that no longer exists and for ciphertext it
 * cannot decrypt; either way the wrapped key is unrecoverable, which is what the caller needs to
 * know. 404 is included because a key read after deletion answers with it.
 */
const NOT_DECRYPTABLE: ReadonlySet<number> = new Set([400, 404]);

/**
 * Key-encryption keys held in HashiCorp Vault's Transit engine.
 *
 * Transit was chosen over AWS KMS, GCP Cloud KMS and Azure Managed HSM on one property: its delete
 * is immediate. AWS schedules deletion 7–30 days out and permits cancellation throughout; GCP's
 * floor is 24 hours with the version restorable until then. Either would have forced the release
 * gate at data-protection-and-retention.txt:110-112 — erase, then attempt recovery, and any
 * recovered fragment fails — to be rewritten into an assertion about a scheduled intent rather than
 * about irrecoverability.
 */
export class VaultTransitKeyCustodian implements KeyCustodian {
  readonly #transport: VaultTransport;
  readonly #now: () => Date;
  /**
   * Key names this process has already created and configured for deletion.
   *
   * Without it every seal re-POSTs create and `/config` — two extra round trips on the hot path for
   * a key that has existed since the subject's first record, and a repeat-create call pattern that
   * is the normal case yet was never exercised against a real Vault. Purely an optimisation: a
   * restart empties it and the next seal simply ensures again, which is idempotent.
   */
  readonly #ensured = new Set<string>();

  constructor(options: { readonly transport: VaultTransport; readonly now: () => Date }) {
    this.#transport = options.transport;
    this.#now = options.now;
  }

  async issueDataKey(name: CustodyKeyName): Promise<Result<DataKey, KeyStoreFailure>> {
    const prepared = await this.#ensureKey(name);
    if (!prepared.ok) {
      return err(prepared.error);
    }

    const response = await this.#transport.send(
      "POST",
      `/v1/transit/datakey/plaintext/${encodeURIComponent(name)}`,
      { bits: DATA_KEY_BITS },
    );
    if (response.status !== 200) {
      return err(unreachable(name, "datakey", response));
    }
    const data = readData(response.body);
    const plaintext = readString(data, "plaintext");
    const ciphertext = readString(data, "ciphertext");
    if (plaintext === undefined || ciphertext === undefined) {
      return err({ kind: "custodian-unreachable", detail: `datakey for ${name} had no key` });
    }
    return ok({ plaintext: fromBase64(plaintext), wrapped: ciphertext });
  }

  async unwrapDataKey(
    name: CustodyKeyName,
    wrapped: string,
  ): Promise<Result<Uint8Array, KeyStoreFailure>> {
    const response = await this.#transport.send(
      "POST",
      `/v1/transit/decrypt/${encodeURIComponent(name)}`,
      { ciphertext: wrapped },
    );
    // Only Transit's own "I cannot open this" answer means the key is gone. Everything else — a
    // socket that never connected, a 403 from a rotated policy, a 429, a 500 from a sealed or
    // mid-election Vault — is infrastructure, and saying "erased" there is the failure this union
    // exists to prevent: a person reported as erased because a server was briefly unwell. The
    // damage is not theoretical, because callers drop what they cannot unseal.
    if (response.status !== 200 && !NOT_DECRYPTABLE.has(response.status)) {
      return err(unreachable(name, "decrypt", response));
    }
    if (response.status !== 200) {
      return err({ kind: "key-destroyed", name });
    }
    const plaintext = readString(readData(response.body), "plaintext");
    return plaintext === undefined
      ? err({ kind: "custodian-unreachable", detail: `decrypt for ${name} had no plaintext` })
      : ok(fromBase64(plaintext));
  }

  async destroyKey(name: CustodyKeyName): Promise<Result<ErasureProof, KeyStoreFailure>> {
    const deleted = await this.#transport.send(
      "DELETE",
      `/v1/transit/keys/${encodeURIComponent(name)}`,
    );
    if (deleted.status !== 204 && deleted.status !== 200) {
      return err(unreachable(name, "delete", deleted));
    }

    // The confirmation read is the whole basis for calling this proof `external`, so it is not
    // optional and its absence is not a warning.
    //
    // Transit's DELETE answers 204 with no body, and its audit-device entry is not readable from
    // here — so the claim this proof makes is deliberately *not* "Vault issued this record". It is
    // "the key is gone from a store this process does not control, and any third party holding read
    // access can confirm that independently". A DELETE that returned 204 while the key survived — a
    // partitioned standby, a policy granting delete but not read, a proxy that lied — would leave
    // this platform signing a record of a destruction it never witnessed.
    const confirmation = await this.#transport.send(
      "GET",
      `/v1/transit/keys/${encodeURIComponent(name)}`,
    );
    if (confirmation.status !== 404) {
      return err({ kind: "destruction-unconfirmed", name });
    }

    this.#ensured.delete(name);
    return ok({
      target: name,
      destroyedAt: this.#now().toISOString(),
      keyReference: `vault:transit/keys/${name}`,
      recordId: crypto.randomUUID(),
      attestation: "external",
    });
  }

  /**
   * Creation and `deletion_allowed` together, never separately. Transit refuses DELETE unless the
   * key's config permits it, and key creation is the only moment guaranteed to precede the erasure
   * request. A key created without it is a data subject who cannot be erased — discovered at the
   * one moment when there is a statutory clock running.
   */
  async #ensureKey(name: CustodyKeyName): Promise<Result<null, KeyStoreFailure>> {
    if (this.#ensured.has(name)) {
      return ok(null);
    }
    const created = await this.#transport.send(
      "POST",
      `/v1/transit/keys/${encodeURIComponent(name)}`,
      { type: "aes256-gcm96" },
    );
    if (created.status !== 204 && created.status !== 200) {
      return err(unreachable(name, "create", created));
    }
    const configured = await this.#transport.send(
      "POST",
      `/v1/transit/keys/${encodeURIComponent(name)}/config`,
      { deletion_allowed: true },
    );
    if (configured.status !== 204 && configured.status !== 200) {
      return err(unreachable(name, "config", configured));
    }
    // Recorded only after both calls succeeded. Marking it earlier would cache a key that exists
    // but cannot be deleted, which is a subject who cannot be erased.
    this.#ensured.add(name);
    return ok(null);
  }
}

function unreachable(name: string, operation: string, response: VaultResponse): KeyStoreFailure {
  return {
    kind: "custodian-unreachable",
    detail: `${operation} for ${name} answered ${String(response.status)}`,
  };
}

function readData(body: unknown): unknown {
  return isRecord(body) ? body["data"] : undefined;
}

function readString(source: unknown, name: string): string | undefined {
  if (!isRecord(source)) {
    return undefined;
  }
  const value = source[name];
  return typeof value === "string" ? value : undefined;
}

function fromBase64(value: string): Uint8Array {
  const decoded = Buffer.from(value, "base64");
  const bytes = new Uint8Array(new ArrayBuffer(decoded.byteLength));
  bytes.set(decoded);
  return bytes;
}
