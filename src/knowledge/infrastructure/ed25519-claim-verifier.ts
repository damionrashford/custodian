import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { err, isRecord, ok, parseTenantId, type Result } from "@custodian/primitives";
import type { ClaimContents, ClaimRejection, ClaimVerifier } from "../domain/tenant-claim";

/**
 * Isolation is enforced "at the query layer using a signed JWT claim carrying the tenant ID — never
 * by instructing the model" (AI_Agent_Implementation_Plan_v2.txt:156). This is that verifier.
 *
 * Asymmetric on purpose. A shared secret makes every party that can *check* a claim also able to
 * *mint* one, so the platform verifying tenant identity could forge tenant identity — and a leaked
 * secret is an unexpiring credential, which is the shape LD-7 exists to refuse. With Ed25519 the
 * platform holds only the public key.
 *
 * Signature verification is synchronous here (`node:crypto`) rather than WebCrypto's async
 * `subtle.verify`, because the port is sync and every query crosses it: making it async would
 * cascade through every caller for no security gain.
 */
export class Ed25519ClaimVerifier implements ClaimVerifier {
  readonly #publicKey: KeyObject;

  /** @param publicKeyPem SPKI PEM for the issuer's Ed25519 public key. */
  constructor(publicKeyPem: string) {
    this.#publicKey = createPublicKey(publicKeyPem);
  }

  verify(token: string): Result<ClaimContents, ClaimRejection> {
    const parts = token.split(".");
    const [header, payload, signature] = parts;
    if (
      parts.length !== 3 ||
      header === undefined ||
      payload === undefined ||
      signature === undefined
    ) {
      return err({ kind: "claim-malformed", received: token });
    }

    // Signature first: nothing inside an unverified token is worth parsing, and a rejection that
    // named a payload problem would tell an attacker their forgery parsed.
    const signed = Buffer.from(`${header}.${payload}`);
    let valid: boolean;
    try {
      valid = verify(null, signed, this.#publicKey, Buffer.from(signature, "base64url"));
    } catch {
      return err({ kind: "signature-invalid" });
    }
    if (!valid) {
      return err({ kind: "signature-invalid" });
    }

    return claimsFrom(payload, token);
  }
}

function claimsFrom(payload: string, token: string): Result<ClaimContents, ClaimRejection> {
  const malformed: ClaimRejection = { kind: "claim-malformed", received: token };
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return err(malformed);
  }
  if (!isRecord(parsed)) {
    return err(malformed);
  }

  const rawTenant = parsed["tenant"];
  const issuedAt = parsed["iat"];
  const expiresAt = parsed["exp"];
  if (
    typeof rawTenant !== "string" ||
    typeof issuedAt !== "number" ||
    typeof expiresAt !== "number"
  ) {
    return err(malformed);
  }
  const tenant = parseTenantId(rawTenant);
  if (!tenant.ok) {
    return err(malformed);
  }

  // Seconds on the wire (the JWT convention), milliseconds inside — converted once, here, so no
  // caller has to remember which unit a claim is carrying.
  return ok({
    tenant: tenant.value,
    issuedAt: new Date(issuedAt * 1000).toISOString(),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  });
}
