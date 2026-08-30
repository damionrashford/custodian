/**
 * The narrowing every "parse, don't validate" boundary starts with. It lives here because four
 * boundaries in three packages need exactly this and nothing more — four private copies of one
 * guard drift the moment one of them is refined.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
