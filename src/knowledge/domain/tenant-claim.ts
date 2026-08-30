import { brand, type Brand, err, ok, type Result, type TenantId } from "@custodian/primitives";

/**
 * A tenant identity that has been cryptographically verified AND is currently valid. Isolation is
 * enforced at the query layer using a signed claim carrying the tenant ID — never by instructing the
 * model (AI_Agent_Implementation_Plan_v2.txt:156).
 *
 * Any retrieval returning another tenant's namespace pages and is treated as a breach until
 * disproven (Reliability_and_Operations.txt:84-86), so this is the highest-stakes boundary in the
 * platform and it is verified accordingly.
 */
export type VerifiedTenantClaim = Brand<
  { readonly tenant: TenantId; readonly expiresAt: string },
  "VerifiedTenantClaim"
>;

/** What a verifier extracts from a token before this module decides whether to trust it. */
export type ClaimContents = {
  readonly tenant: TenantId;
  readonly issuedAt: string;
  readonly expiresAt: string;
};

/**
 * Which key signed a claim, carried in the token header.
 *
 * Rotation without this is a hard cutover that invalidates every live claim at once. With it the
 * verifier holds a ring and accepts any key in it, so a rotation becomes: add the new key to every
 * ring, start issuing under it, and retire the old one only once the longest live claim has expired
 * — the overlap the corpus prescribes, "publish the key ID in the signature header, accept both keys
 * during the overlap window, and only then retire the old one" (Gap_Register_v2.txt:272).
 */
export type SigningKeyId = Brand<string, "SigningKeyId">;

export type InvalidSigningKeyId = {
  readonly kind: "invalid-signing-key-id";
  readonly received: string;
};

const SIGNING_KEY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function parseSigningKeyId(value: string): Result<SigningKeyId, InvalidSigningKeyId> {
  return SIGNING_KEY_ID_PATTERN.test(value)
    ? ok(brand<SigningKeyId>(value))
    : err({ kind: "invalid-signing-key-id", received: value });
}

export type ClaimRejection =
  | { readonly kind: "signature-invalid" }
  | { readonly kind: "claim-malformed"; readonly received: string }
  | { readonly kind: "expired"; readonly expiresAt: string }
  | { readonly kind: "not-yet-valid"; readonly issuedAt: string }
  | { readonly kind: "lifetime-too-long"; readonly lifetimeMs: number; readonly maxMs: number }
  /** The header named a key the ring does not hold — one already retired, or never trusted. */
  | { readonly kind: "unknown-signing-key"; readonly kid: string }
  /**
   * The header named an algorithm this platform does not sign with. Checked explicitly rather than
   * left to the signature check: algorithm confusion is the oldest JWT attack there is, and a
   * verifier that skips it because "the signature would fail anyway" is one library change away
   * from that stopping being true.
   */
  | { readonly kind: "wrong-algorithm"; readonly alg: string };

export interface ClaimVerifier {
  verify(token: string): Result<ClaimContents, ClaimRejection>;
}

export type IssueRequest = {
  readonly tenant: TenantId;
  readonly issuedAt: Date;
  readonly lifetimeMs: number;
};

export type IssuanceFailure =
  | { readonly kind: "lifetime-too-long"; readonly lifetimeMs: number; readonly maxMs: number }
  | { readonly kind: "lifetime-not-positive"; readonly lifetimeMs: number };

/**
 * Mints tenant claims. Kept apart from the verifier by more than tidiness: whoever implements this
 * holds a private key, and the serving path deliberately does not — a platform that can verify a
 * tenant identity must not also be able to forge one.
 */
export interface ClaimIssuer {
  issue(request: IssueRequest): Result<string, IssuanceFailure>;
}

/**
 * The issuer bounds the lifetime as well, rather than leaving it to the verifier.
 *
 * The verifier's bound is the one that protects the platform from a hostile issuer, and it cannot be
 * removed. This one protects the platform from its own mistake: a caller passing seconds where
 * milliseconds were meant mints a token every verifier then rejects, and the failure surfaces at
 * every consumer instead of at the one line that caused it.
 */
export type InvalidKeyRing =
  | { readonly kind: "key-ring-unparseable" }
  | { readonly kind: "key-ring-empty" }
  | { readonly kind: "key-ring-entry-invalid"; readonly kid: string };

/**
 * Reads a verifier's key ring from configuration, as `{"<kid>": "<SPKI PEM>"}`.
 *
 * JSON rather than a delimited string because a PEM contains newlines, and every scheme for
 * smuggling those through a delimiter ends in a key that silently fails to parse. An empty ring is
 * rejected here rather than at the first query: it rejects every claim, which reads in production
 * as a total tenant outage reported one request at a time.
 */
export function parseKeyRing(
  source: string,
): Result<ReadonlyMap<SigningKeyId, string>, InvalidKeyRing> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return err({ kind: "key-ring-unparseable" });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return err({ kind: "key-ring-unparseable" });
  }

  const ring = new Map<SigningKeyId, string>();
  for (const [rawKid, pem] of Object.entries(parsed)) {
    const kid = parseSigningKeyId(rawKid);
    if (!kid.ok || typeof pem !== "string" || !pem.includes("BEGIN PUBLIC KEY")) {
      return err({ kind: "key-ring-entry-invalid", kid: rawKid });
    }
    ring.set(kid.value, pem);
  }
  return ring.size === 0 ? err({ kind: "key-ring-empty" }) : ok(ring);
}

export function boundedLifetime(lifetimeMs: number): Result<number, IssuanceFailure> {
  if (lifetimeMs <= 0) {
    return err({ kind: "lifetime-not-positive", lifetimeMs });
  }
  return lifetimeMs > MAX_CLAIM_LIFETIME_MS
    ? err({ kind: "lifetime-too-long", lifetimeMs, maxMs: MAX_CLAIM_LIFETIME_MS })
    : ok(lifetimeMs);
}

/**
 * One hour, deliberately longer than the five-minute agent-card window. The two boundaries take
 * different controls because they have different shapes:
 *
 * - An agent card is presented once per handoff, so a nonce ledger is the right replay defence and
 *   a short window costs nothing.
 * - A tenant claim is a bearer credential replayed on *every* query by design, so a nonce ledger
 *   would reject legitimate reuse. Bounded lifetime is the control that fits.
 *
 * Copying the card's controls here would have broken normal operation; copying none of them left
 * a captured token valid forever.
 */
export const MAX_CLAIM_LIFETIME_MS = 60 * 60 * 1000;

export type ClaimVerificationDeps = {
  readonly verifier: ClaimVerifier;
  readonly now: Date;
};

/**
 * Checking `expiresAt` alone is not enough. An issuer that can set expiry arbitrarily far out
 * defeats the control entirely — a token minted with a ten-year lifetime passes an expiry check and
 * is functionally the unexpiring token this exists to prevent. So the *lifetime* is bounded, not
 * just the deadline.
 */
export function verifyTenantClaim(
  token: string,
  deps: ClaimVerificationDeps,
): Result<VerifiedTenantClaim, ClaimRejection> {
  const verified = deps.verifier.verify(token);
  if (!verified.ok) {
    return err(verified.error);
  }

  const { tenant, issuedAt, expiresAt } = verified.value;
  const issued = Date.parse(issuedAt);
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(issued) || Number.isNaN(expires)) {
    return err({ kind: "claim-malformed", received: `${issuedAt}..${expiresAt}` });
  }

  const nowMs = deps.now.getTime();
  if (issued > nowMs) {
    return err({ kind: "not-yet-valid", issuedAt });
  }
  if (expires <= nowMs) {
    return err({ kind: "expired", expiresAt });
  }

  const lifetimeMs = expires - issued;
  if (lifetimeMs > MAX_CLAIM_LIFETIME_MS) {
    return err({ kind: "lifetime-too-long", lifetimeMs, maxMs: MAX_CLAIM_LIFETIME_MS });
  }

  return ok(
    brand<VerifiedTenantClaim, { readonly tenant: TenantId; readonly expiresAt: string }>({
      tenant,
      expiresAt,
    }),
  );
}
