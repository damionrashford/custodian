/**
 * Pinned constraints are a distinct variant rather than a flag on a message, so the compactor has
 * to handle them explicitly and dropping one is a type error rather than a silent omission.
 *
 * Research on long-horizon agents finds compaction systems optimise for task accuracy or
 * throughput, and none measure whether governance constraints survive the rewrite or whether their
 * deletion causes unsafe tool calls (AI_Agent_Implementation_Plan_v2.txt:169-170).
 */
export type ContextItem =
  | { readonly kind: "pinned-constraint"; readonly text: string }
  | { readonly kind: "message"; readonly text: string; readonly at: string }
  | {
      readonly kind: "tool-output";
      readonly text: string;
      readonly tool: string;
      readonly truncated: boolean;
    };

export function textOf(item: ContextItem): string {
  return item.text;
}
