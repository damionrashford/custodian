/** What the environment says about where subject keys should live. */
export type CustodySettings = {
  readonly vaultAddress: string | undefined;
  readonly vaultToken: string | undefined;
  readonly devMode: string | undefined;
};

export type CustodyDecision =
  | { readonly kind: "vault"; readonly address: string; readonly token: string }
  | { readonly kind: "in-memory" }
  | { readonly kind: "refuse" };

function present(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

/**
 * Where the key-encryption keys come from, decided once and as data, so the boot path can be tested
 * without starting a server or reaching a KMS.
 *
 * The load-bearing case is the half-configured one. A deployment that names a Vault address but
 * whose token is empty — a typo, an unmounted secret, a rotated credential nobody re-supplied — must
 * refuse, *even when the development acknowledgement is also set*. Falling back to in-process keys
 * there is the worst available outcome: the service boots green, serves traffic, writes sealed rows
 * to disk, and silently stops being erasable. Nothing observes it until an erasure request arrives
 * against keys a restart already destroyed.
 */
export function custodyDecision(settings: CustodySettings): CustodyDecision {
  const { vaultAddress, vaultToken, devMode } = settings;
  if (present(vaultAddress) && present(vaultToken)) {
    return { kind: "vault", address: vaultAddress, token: vaultToken };
  }
  if (present(vaultAddress) || present(vaultToken)) {
    return { kind: "refuse" };
  }
  return devMode === "1" ? { kind: "in-memory" } : { kind: "refuse" };
}
