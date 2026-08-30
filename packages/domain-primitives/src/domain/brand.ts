declare const BRAND: unique symbol;

/**
 * Nominal typing over a structural carrier. A `TenantId` is not interchangeable with any other
 * string, which is what makes the platform's tenant-isolation guarantees hold at compile time
 * rather than by convention (Engineering_Standards.txt:109).
 */
export type Brand<Carrier, Name extends string> = Carrier & { readonly [BRAND]: Name };
