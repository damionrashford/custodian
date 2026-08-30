import type { Result, ToolName } from "@custodian/domain-primitives";
import type { TaskClass } from "./task-class";

/**
 * What is always in context. Name plus one line — nothing else, because MCP loading every tool
 * description in full at session start is the single largest source of wasted context
 * (Agent_Architecture_Addendum.txt:128).
 */
export type ToolSummary = {
  readonly name: ToolName;
  readonly summary: string;
};

/** What enters context only once the model reaches for this specific tool. */
export type ToolDefinition = ToolSummary & {
  readonly schema: string;
  readonly serverId: string;
};

export type CatalogueFailure = {
  readonly kind: "tool-not-in-scope";
  readonly name: ToolName;
};

export interface ToolCatalogue {
  index(scope: TaskClass): Promise<Result<readonly ToolSummary[], CatalogueFailure>>;
  define(scope: TaskClass, name: ToolName): Promise<Result<ToolDefinition, CatalogueFailure>>;
}
