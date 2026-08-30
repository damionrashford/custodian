declare const BRAND: unique symbol;

/**
 * Nominal typing over a structural carrier. A `TenantId` is not interchangeable with any other
 * string, which is what makes the platform's tenant-isolation guarantees hold at compile time
 * rather than by convention (Engineering_Standards.txt:109).
 */
export type Brand<Carrier, Name extends string> = Carrier & { readonly [BRAND]: Name };

/**
 * The one sanctioned type assertion in the platform. A brand has no runtime representation to
 * attach, so constructing one is unrepresentable without an assertion — confining it to this
 * function means every other file is bound by `assertionStyle: never`, and a reviewer asking "can
 * an illegal state be constructed?" has exactly one place to look.
 *
 * It is tighter than the `as` it replaces: the carrier type must match, so `brand<TenantId>(x)`
 * rejects anything that is not already a string, where `x as unknown as TenantId` would not.
 */
export function brand<B extends Brand<C, string>, C = string>(value: C): B {
  return value as unknown as B;
}
