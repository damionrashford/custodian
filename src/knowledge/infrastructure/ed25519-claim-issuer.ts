import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import { err, ok, type Result } from "@custodian/primitives";
import {
  boundedLifetime,
  type ClaimIssuer,
  type IssuanceFailure,
  type IssueRequest,
  type SigningKeyId,
} from "../domain/tenant-claim";

/**
 * Mints tenant claims under one active signing key.
 *
 * The active key is deliberately singular while the verifier's ring is plural, and that asymmetry is
 * what makes rotation safe: a new key joins every verifier's ring first, then one issuer switches to
 * it, then the old key leaves the rings once the longest live claim has expired. Reversing the order
 * — issuing under a key the verifiers do not yet hold — rejects every claim minted in the gap.
 *
 * This class is never composed into the serving path. Holding it means holding a private key, and a
 * platform that can verify a tenant identity must not also be able to forge one.
 */
export class Ed25519ClaimIssuer implements ClaimIssuer {
  readonly #kid: SigningKeyId;
  readonly #privateKey: KeyObject;

  /** @param privateKeyPem PKCS#8 PEM for the active Ed25519 signing key. */
  constructor(options: { readonly kid: SigningKeyId; readonly privateKeyPem: string }) {
    this.#kid = options.kid;
    this.#privateKey = createPrivateKey(options.privateKeyPem);
  }

  issue(request: IssueRequest): Result<string, IssuanceFailure> {
    const lifetime = boundedLifetime(request.lifetimeMs);
    if (!lifetime.ok) {
      return err(lifetime.error);
    }

    const issuedMs = request.issuedAt.getTime();
    const header = encode({ alg: "EdDSA", typ: "JWT", kid: String(this.#kid) });
    const payload = encode({
      tenant: String(request.tenant),
      // Seconds on the wire, the JWT convention the verifier reads back.
      iat: Math.floor(issuedMs / 1000),
      exp: Math.floor((issuedMs + lifetime.value) / 1000),
    });
    const signature = sign(null, Buffer.from(`${header}.${payload}`), this.#privateKey);
    return ok(`${header}.${payload}.${signature.toString("base64url")}`);
  }
}

function encode(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
