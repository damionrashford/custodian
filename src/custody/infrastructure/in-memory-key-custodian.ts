import {
  err,
  ok,
  type ErasureProof,
  type KeyStoreFailure,
  type Result,
} from "@custodian/primitives";
import type { CustodyKeyName, DataKey, KeyCustodian } from "../domain/key-custodian";

const KEY_BYTES = 32;

/**
 * The custodian used by tests and by the development boot path. It behaves exactly like the Vault
 * one except in the two ways that matter and are therefore visible: the key-encryption keys live in
 * this process, so a restart destroys them all, and its proofs say `self` because no party outside
 * this process can be asked whether the key is really gone.
 */
export class InMemoryKeyCustodian implements KeyCustodian {
  readonly #keks = new Set<string>();
  readonly #wrapped = new Map<string, Uint8Array>();
  readonly #now: () => Date;

  constructor(options: { readonly now: () => Date }) {
    this.#now = options.now;
  }

  issueDataKey(name: CustodyKeyName): Promise<Result<DataKey, KeyStoreFailure>> {
    this.#keks.add(name);
    const plaintext = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
    // A handle, not a ciphertext. Wrapping here would mean implementing a second cryptosystem in
    // order to test the first, and the property under test is "unwrap fails once the KEK is gone".
    const handle = `local:${name}:${crypto.randomUUID()}`;
    this.#wrapped.set(handle, plaintext);
    return Promise.resolve(ok({ plaintext, wrapped: handle }));
  }

  unwrapDataKey(
    name: CustodyKeyName,
    wrapped: string,
  ): Promise<Result<Uint8Array, KeyStoreFailure>> {
    if (!this.#keks.has(name)) {
      return Promise.resolve(err({ kind: "key-destroyed", name }));
    }
    const plaintext = this.#wrapped.get(wrapped);
    return Promise.resolve(
      plaintext === undefined ? err({ kind: "ciphertext-corrupt" }) : ok(plaintext),
    );
  }

  destroyKey(name: CustodyKeyName): Promise<Result<ErasureProof, KeyStoreFailure>> {
    this.#keks.delete(name);
    // The wrapped keys go too. Leaving them would make this store's "destroyed" weaker than Vault's,
    // where the material genuinely cannot be recovered — and a test double that is more forgiving
    // than production is a test double that passes things production would reject.
    for (const handle of [...this.#wrapped.keys()]) {
      if (handle.startsWith(`local:${name}:`)) {
        this.#wrapped.delete(handle);
      }
    }
    return Promise.resolve(
      ok({
        target: name,
        destroyedAt: this.#now().toISOString(),
        keyReference: `local:${name}`,
        recordId: crypto.randomUUID(),
        // This process destroyed the key and is now writing the record of having done so. Naming
        // that is what stops it being mistaken for the KMS record the spec asks for.
        attestation: "self",
      }),
    );
  }
}
