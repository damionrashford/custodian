/**
 * Expected failures — provider timeout, guardrail rejection, budget exceeded — are values in the
 * return type. Throwing is reserved for programmer error (engineering-standards.txt:111).
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
