import { err, ok, type Result } from "@custodian/domain-primitives";
import type {
  CatalogueFailure,
  ToolCatalogue,
  ToolDefinition,
  ToolSummary,
} from "../domain/tool-catalogue";
import type { TaskClass, ToolName } from "../domain/tool-name";

export type CatalogueContents = {
  readonly definitions: readonly ToolDefinition[];
  readonly allowlists: ReadonlyMap<TaskClass, readonly ToolName[]>;
};

/**
 * Servers are scoped per task class and individual tools filtered by allowlist, rather than whole
 * servers being exposed (Agent_Architecture_Addendum.txt:146).
 */
export class InMemoryToolCatalogue implements ToolCatalogue {
  readonly #definitions: ReadonlyMap<string, ToolDefinition>;
  readonly #allowlists: ReadonlyMap<TaskClass, readonly ToolName[]>;

  constructor(contents: CatalogueContents) {
    this.#definitions = new Map(contents.definitions.map((entry) => [entry.name, entry]));
    this.#allowlists = contents.allowlists;
  }

  index(scope: TaskClass): Promise<Result<readonly ToolSummary[], CatalogueFailure>> {
    const summaries = this.#inScope(scope).map((definition) => ({
      name: definition.name,
      summary: definition.summary,
    }));
    return Promise.resolve(ok(summaries));
  }

  define(scope: TaskClass, name: ToolName): Promise<Result<ToolDefinition, CatalogueFailure>> {
    const found = this.#inScope(scope).find((definition) => definition.name === name);
    return Promise.resolve(
      found === undefined ? err({ kind: "tool-not-in-scope", name }) : ok(found),
    );
  }

  #inScope(scope: TaskClass): readonly ToolDefinition[] {
    const allowed = this.#allowlists.get(scope) ?? [];
    const resolved: ToolDefinition[] = [];
    for (const name of allowed) {
      const definition = this.#definitions.get(name);
      if (definition !== undefined) {
        resolved.push(definition);
      }
    }
    return resolved;
  }
}
