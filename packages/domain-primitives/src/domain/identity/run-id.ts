import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";

export type RunId = Brand<string, "RunId">;

export type InvalidRunId = { readonly kind: "invalid-run-id"; readonly received: string };

/**
 * The grammar and the alphabet that satisfies it live together on purpose. Split across packages
 * — a parser here, a generator in an interface layer — they agree until one changes, and the drift
 * surfaces as a runtime throw on a path that used to work.
 *
 * Crockford-style: 32 symbols with `i`, `l`, `o` and `u` removed. Run ids are read aloud, copied
 * out of logs and typed into queries during an incident, and `1`/`l` and `0`/`o` are the pairs
 * that get transcribed wrong under exactly that pressure.
 */
const RUN_ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const RUN_ID_BODY_LENGTH = 26;
const RUN_ID_PATTERN = /^r_[0-9a-z]{26}$/;

export function parseRunId(value: string): Result<RunId, InvalidRunId> {
  return RUN_ID_PATTERN.test(value)
    ? ok(brand<RunId>(value))
    : err({ kind: "invalid-run-id", received: value });
}

/**
 * Every character drawn from `RUN_ID_ALPHABET` satisfies `RUN_ID_PATTERN` by construction, which
 * is why this returns a `RunId` rather than a `Result`: there is no input to reject.
 */
export function generateRunId(): RunId {
  const bytes = new Uint8Array(RUN_ID_BODY_LENGTH);
  crypto.getRandomValues(bytes);
  let id = "r_";
  for (const byte of bytes) {
    id += RUN_ID_ALPHABET[byte % RUN_ID_ALPHABET.length] ?? "0";
  }
  return brand<RunId>(id);
}
