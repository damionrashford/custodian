import { err, ok, type Result } from "@custodian/domain-primitives";
import type { ContextItem } from "./context-item";
import type { TokenCounter } from "./token-counter";

export type CompactionFailure = {
  readonly kind: "pins-exceed-budget";
  readonly pinnedTokens: number;
  readonly budgetTokens: number;
};

function tokensOf(items: readonly ContextItem[], countTokens: TokenCounter): number {
  return items.reduce((total, item) => total + countTokens(item.text), 0);
}

/**
 * Compaction is a deliberate response to a named constraint, not a default. Under modern prompt
 * caching, keeping the full history beat every summarisation strategy tested on cost, latency and
 * memory recall simultaneously, because summarising rewrites the cached prefix and forfeits the
 * discount on everything it was meant to save (AI_Agent_Implementation_Plan_v2.txt:167). So a
 * context that already fits is returned unchanged.
 *
 * Pinned constraints are never candidates for eviction. If they alone exceed the budget this fails
 * rather than dropping one, because a silently-dropped safety constraint is the failure mode no
 * functional test catches.
 */
export function compact(
  items: readonly ContextItem[],
  budgetTokens: number,
  countTokens: TokenCounter,
): Result<readonly ContextItem[], CompactionFailure> {
  if (tokensOf(items, countTokens) <= budgetTokens) {
    return ok(items);
  }

  const pinned = items.filter((item) => item.kind === "pinned-constraint");
  const pinnedTokens = tokensOf(pinned, countTokens);
  if (pinnedTokens > budgetTokens) {
    return err({ kind: "pins-exceed-budget", pinnedTokens, budgetTokens });
  }

  // Evict oldest-first from the non-pinned tail until the whole context fits.
  const evictable = items.filter((item) => item.kind !== "pinned-constraint");
  let kept = evictable;
  while (kept.length > 0 && pinnedTokens + tokensOf(kept, countTokens) > budgetTokens) {
    kept = kept.slice(1);
  }

  return ok(items.filter((item) => item.kind === "pinned-constraint" || kept.includes(item)));
}
