import type { ModelSnapshot } from "@custodian/domain-primitives";

export type ModelPrice = {
  readonly inputMicrosPerToken: number;
  readonly outputMicrosPerToken: number;
};

/** Keyed by pinned snapshot, so a price is never ambiguous across a model retirement. */
export type PriceTable = ReadonlyMap<ModelSnapshot, ModelPrice>;
