import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { err, isRecord, ok, parseTenantId, type Result } from "@custodian/primitives";
import {
  parseSigningKeyId,
  type ClaimContents,
  type ClaimRejection,
  type ClaimVerifier,
  type SigningKeyId,
} from "../domain/tenant-claim";

/** The only algorithm this platform signs with. Anything else is refused before a key is chosen. */
const SIGNING_ALGORITHM = "EdDSA";

/**
 * Isolation is enforced "at the query layer using a signed JWT claim carrying the tenant ID — never
 * by instructing the model" (implementation-plan.txt:156). This is that verifier.
 *
 * Asymmetric on purpose. A shared secret makes every party that can *check* a claim also able to
 * *mint* one, so the platform verifying tenant identity could forge tenant identity — and a leaked
 * secret is an unexpiring credential, which is the shape LD-7 exists to refuse. With Ed25519 the
 * platform holds only public keys.
 *
 * It holds a *ring* of them, not one. A single key makes rotation a hard cutover that invalidates
 * every claim in flight; a ring makes it the overlap window the corpus asks for
 * (gap-register.txt:272). The `kid` in the header selects from that ring and can do nothing
 * else — it is attacker-controlled input, so it picks among keys an operator already configured and
 * can never introduce one.
 *
 * Signature verification is synchronous here (`node:crypto`) rather than WebCrypto's async
 * `subtle.verify`, because the port is sync and every query crosses it: making it async would
 * cascade through every caller for no security gain.
 */
export class Ed25519ClaimVerifier implements ClaimVerifier {
  readonly #keys: ReadonlyMap<string, KeyObject>;

  /** @param keys SPKI PEM per signing key id. Every key in the ring is currently trusted. */
  constructor(keys: ReadonlyMap<SigningKeyId, string>) {
    if (keys.size === 0) {
      throw new Error("Ed25519ClaimVerifier: the key ring is empty, so no claim could ever verify");
    }
    this.#keys = new Map([...keys].map(([kid, pem]) => [String(kid), createPublicKey(pem)]));
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

    // The header is unverified input, so it is used for exactly two things: naming an algorithm this
    // platform accepts, and selecting a key an operator already trusts. Nothing it says can
    // introduce key material or weaken the check that follows.
    const selected = this.#keyFor(header, token);
    if (!selected.ok) {
      return err(selected.error);
    }

    // Signature next: nothing inside an unverified payload is worth parsing, and a rejection that
    // named a payload problem would tell an attacker their forgery parsed.
    const signed = Buffer.from(`${header}.${payload}`);
    let valid: boolean;
    try {
      valid = verify(null, signed, selected.value, Buffer.from(signature, "base64url"));
    } catch {
      return err({ kind: "signature-invalid" });
    }
    if (!valid) {
      return err({ kind: "signature-invalid" });
    }

    return claimsFrom(payload, token);
  }

  #keyFor(header: string, token: string): Result<KeyObject, ClaimRejection> {
    const parsed = decodeSegment(header);
    if (parsed === undefined) {
      return err({ kind: "claim-malformed", received: token });
    }

    const alg = parsed["alg"];
    if (typeof alg !== "string") {
      return err({ kind: "claim-malformed", received: token });
    }
    if (alg !== SIGNING_ALGORITHM) {
      return err({ kind: "wrong-algorithm", alg });
    }

    const rawKid = parsed["kid"];
    if (typeof rawKid !== "string") {
      return err({ kind: "claim-malformed", received: token });
    }
    const kid = parseSigningKeyId(rawKid);
    if (!kid.ok) {
      return err({ kind: "unknown-signing-key", kid: rawKid });
    }
    const key = this.#keys.get(String(kid.value));
    return key === undefined ? err({ kind: "unknown-signing-key", kid: rawKid }) : ok(key);
  }
}

function decodeSegment(segment: string): Record<string, unknown> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  return isRecord(parsed) ? parsed : undefined;
}

function claimsFrom(payload: string, token: string): Result<ClaimContents, ClaimRejection> {
  const malformed: ClaimRejection = { kind: "claim-malformed", received: token };
  const parsed = decodeSegment(payload);
  if (parsed === undefined) {
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
