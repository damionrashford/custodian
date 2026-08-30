import {
  err,
  isRecord,
  ok,
  type Namespace,
  type Result,
  type ToolName,
} from "@custodian/primitives";
import type { VectorIndex } from "@custodian/knowledge";
import type { Embedder } from "@custodian/knowledge";
import type { RetrievedRecord, Tool, ToolFailure, ToolObservation } from "../domain/tool";

export type KbDocument = {
  readonly text: string;
  readonly classification: RetrievedRecord["classification"];
  readonly provenance: RetrievedRecord["provenance"];
};

export type KbSearchToolDeps = {
  readonly name: ToolName;
  readonly embedder: Embedder;
  readonly index: VectorIndex;
  /** Keyed by `kbDocumentKey`, never by bare document id — see that function. */
  readonly documents: ReadonlyMap<string, KbDocument>;
  readonly topK: number;
};

/**
 * Document ids are chosen per tenant and unique only within a namespace, so a map keyed by id
 * alone serves whichever tenant wrote "doc-1" last. The index filters by namespace before scoring;
 * this keeps the text store's key on the same footing, rather than leaving isolation to depend on
 * two tenants never picking the same id. A namespace cannot contain a space, so no key collides.
 */
export function kbDocumentKey(namespace: Namespace, documentId: string): string {
  return `${namespace} ${documentId}`;
}

/**
 * The slice's one tool: read-only retrieval over the tenant knowledge base. Failures carry a kind
 * and a fixed reason only — an index's internal error text names hosts and shards, which must not
 * ride up into a model observation or a log event.
 */
export class KbSearchTool implements Tool {
  readonly name: ToolName;
  /** Reading the tenant's own knowledge base: reversible, and it changes nothing. */
  readonly actionClass = "low-risk-reversible" as const;
  readonly #deps: KbSearchToolDeps;

  constructor(deps: KbSearchToolDeps) {
    this.name = deps.name;
    this.#deps = deps;
  }

  async execute(
    argumentsJson: string,
    namespace: Namespace,
  ): Promise<Result<ToolObservation, ToolFailure>> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(argumentsJson);
    } catch {
      return err({ kind: "invalid-arguments", reason: "arguments-not-json" });
    }
    if (!isRecord(parsed) || typeof parsed["query"] !== "string" || parsed["query"].length === 0) {
      return err({ kind: "invalid-arguments", reason: "missing-query" });
    }

    const embedded = await this.#deps.embedder.embed(parsed["query"]);
    if (!embedded.ok) {
      return err({ kind: "execution-failed", reason: "embedding-unavailable" });
    }
    const matches = await this.#deps.index.query({
      namespace,
      embedding: embedded.value,
      topK: this.#deps.topK,
    });
    if (!matches.ok) {
      return err({ kind: "execution-failed", reason: "index-unavailable" });
    }

    const retrieved = matches.value.flatMap((match) => {
      const document = this.#deps.documents.get(kbDocumentKey(match.namespace, match.documentId));
      return document === undefined
        ? []
        : [
            {
              recordId: match.documentId,
              classification: document.classification,
              provenance: document.provenance,
              text: document.text,
            },
          ];
    });
    return ok({ kind: "retrieved", retrieved });
  }
}
