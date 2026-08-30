import { brand, err, ok, type Brand, type Result } from "@custodian/primitives";

export type ReviewId = Brand<string, "ReviewId">;

export type InvalidReviewId = { readonly kind: "invalid-review-id"; readonly received: string };

/**
 * Same alphabet and reasoning as a run identifier: 32 Crockford symbols with `i`, `l`, `o` and `u`
 * removed, because a review id is read off a pager, typed into a console and quoted in an incident
 * review, and `1`/`l` and `0`/`o` are the pairs transcribed wrong under exactly that pressure.
 *
 * The `rv_` prefix rather than `r_` so a review and a run cannot be confused in a log line. They
 * appear side by side — a run is what the agent is doing, a review is the permission it is waiting
 * on — and a reader who mixes them up looks at the wrong evidence.
 */
const REVIEW_ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const REVIEW_ID_BODY_LENGTH = 26;
const REVIEW_ID_PATTERN = /^rv_[0-9a-z]{26}$/;

export function parseReviewId(value: string): Result<ReviewId, InvalidReviewId> {
  return REVIEW_ID_PATTERN.test(value)
    ? ok(brand<ReviewId>(value))
    : err({ kind: "invalid-review-id", received: value });
}

/** Every character is drawn from the alphabet, so the pattern holds by construction. */
export function generateReviewId(): ReviewId {
  const bytes = new Uint8Array(REVIEW_ID_BODY_LENGTH);
  crypto.getRandomValues(bytes);
  let id = "rv_";
  for (const byte of bytes) {
    id += REVIEW_ID_ALPHABET[byte % REVIEW_ID_ALPHABET.length] ?? "0";
  }
  return brand<ReviewId>(id);
}
