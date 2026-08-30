import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";

/**
 * A pinned snapshot, never a rolling alias. A call site on an alias cannot answer which side of a
 * retirement date it sits on, and the config registry doubles as the model inventory
 * (Gap_Register_v2.txt:189).
 */
export type ModelSnapshot = Brand<string, "ModelSnapshot">;

export type InvalidModelSnapshot = {
  readonly kind: "invalid-model-snapshot";
  readonly received: string;
};

const MODEL_SNAPSHOT_PATTERN = /^[a-z0-9][a-z0-9.-]*-\d{8}$/;

export function parseModelSnapshot(value: string): Result<ModelSnapshot, InvalidModelSnapshot> {
  return MODEL_SNAPSHOT_PATTERN.test(value)
    ? ok(brand<ModelSnapshot>(value))
    : err({ kind: "invalid-model-snapshot", received: value });
}

/** Token counts for one completion. Shared so metering can price without importing the gateway. */
export type CompletionUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};
