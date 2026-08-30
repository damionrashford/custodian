import type { Brand } from "../language/brand";

/**
 * Namespace-per-tenant rather than metadata filtering: query cost is a function of namespace size,
 * offboarding becomes a single delete, and approximate-nearest-neighbour structures in a shared
 * index are built from the entire dataset, leaving hidden coupling between tenants
 * (AI_Agent_Implementation_Plan_v2.txt:156-157).
 *
 * The type is shared vocabulary because every per-tenant store is keyed by it. The only constructor
 * is `namespaceFor` in @custodian/knowledge-base, which takes a verified claim — so a caller still
 * has no vocabulary for naming another tenant's namespace, a stronger guarantee than checking a
 * parameter after the fact.
 */
export type Namespace = Brand<string, "Namespace">;
