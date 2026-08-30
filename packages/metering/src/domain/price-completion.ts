import { err, ok, type Result } from "@custodian/domain-primitives";
import type { CompletionUsage, ModelSnapshot } from "@custodian/gateway";
import type { PriceTable } from "./price-table";

export type UnpricedModel = {
  readonly kind: "unpriced-model";
  readonly model: ModelSnapshot;
};

export type UsageRecord = {
  readonly model: ModelSnapshot;
  readonly usage: CompletionUsage;
};

/**
 * Pure by requirement, not by taste: cost must be recomputable offline from raw usage logs, which is
 * what makes the daily reconciliation against the provider invoice possible
 * (AI_Agent_Implementation_Plan_v2.txt:121). No clock, no lookup beyond the supplied table, no
 * post-hoc adjustment.
 */
export function priceCompletion(
  usage: CompletionUsage,
  model: ModelSnapshot,
  table: PriceTable,
): Result<number, UnpricedModel> {
  const price = table.get(model);
  if (price === undefined) {
    return err({ kind: "unpriced-model", model });
  }
  return ok(
    usage.inputTokens * price.inputMicrosPerToken + usage.outputTokens * price.outputMicrosPerToken,
  );
}

/**
 * One unpriced record fails the whole replay. Under-reporting silently is how a cost dashboard ends
 * up disagreeing with the invoice, and reconciliation exists to make that disagreement loud.
 */
export function replayUsageLog(
  records: readonly UsageRecord[],
  table: PriceTable,
): Result<number, UnpricedModel> {
  let total = 0;
  for (const record of records) {
    const priced = priceCompletion(record.usage, record.model, table);
    if (!priced.ok) {
      return priced;
    }
    total += priced.value;
  }
  return ok(total);
}
