import { err, ok, type Result } from "@custodian/primitives";

/**
 * Reading one field out of an untrusted JSON object.
 *
 * These exist so that every field on the wire crosses a parser rather than an assertion, and so
 * that the seven state parsers next door read as a list of obligations instead of a wall of
 * `typeof` checks. Each returns the narrowed value or names the field that failed — the field name
 * matters, because "malformed frame" in a log is a bug report nobody can act on.
 */
export type WireRejection = { readonly kind: "field-malformed"; readonly field: string };

/**
 * Non-empty on purpose. Every string field in `AgentState` is an obligation to tell the user
 * something specific — the objective, the tool, what already happened — and an empty one renders as
 * the silence the seven states exist to prevent. A frame that has nothing to say should not be sent.
 */
export function readString(
  source: Record<string, unknown>,
  field: string,
): Result<string, WireRejection> {
  const value = source[field];
  return typeof value === "string" && value.length > 0
    ? ok(value)
    : err({ kind: "field-malformed", field });
}

/** Every number on this wire is a position or a tally, so a float or a negative is malformed. */
export function readCount(
  source: Record<string, unknown>,
  field: string,
): Result<number, WireRejection> {
  const value = source[field];
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? ok(value)
    : err({ kind: "field-malformed", field });
}

export function readBoolean(
  source: Record<string, unknown>,
  field: string,
): Result<boolean, WireRejection> {
  const value = source[field];
  return typeof value === "boolean" ? ok(value) : err({ kind: "field-malformed", field });
}

/** An empty list is a real answer here — `alreadyCommitted: []` means "nothing was committed". */
export function readStringArray(
  source: Record<string, unknown>,
  field: string,
): Result<readonly string[], WireRejection> {
  const value = source[field];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry === "")) {
    return err({ kind: "field-malformed", field });
  }
  return ok(value.filter((entry): entry is string => typeof entry === "string"));
}

/**
 * Absent or `null` reads as `undefined`; a present value of the wrong type is still a rejection.
 *
 * The distinction is the whole reason these are separate from the required readers. `JSON.stringify`
 * drops a key whose value is `undefined`, so absence has to mean "not set" for a round trip to
 * survive at all. Coercing a *malformed* value to `undefined` as well would turn a broken queue
 * position into the bare indeterminate spinner the corpus forbids, silently.
 */
export function readOptionalString(
  source: Record<string, unknown>,
  field: string,
): Result<string | undefined, WireRejection> {
  const value = source[field];
  if (value === undefined || value === null) {
    return ok(undefined);
  }
  return typeof value === "string" && value.length > 0
    ? ok(value)
    : err({ kind: "field-malformed", field });
}

export function readOptionalCount(
  source: Record<string, unknown>,
  field: string,
): Result<number | undefined, WireRejection> {
  const value = source[field];
  return value === undefined || value === null ? ok(undefined) : readCount(source, field);
}
