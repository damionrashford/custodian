import { parseToolName, type Namespace, type ToolName } from "@custodian/primitives";
import { sandboxDecision, type CodeExecutor } from "../domain/code-executor";
import type { EgressPolicy } from "../domain/url-policy";
import type { Tool } from "../domain/tool";
import type { ToolDefinition } from "../domain/tool-catalogue";
import { ReadFileTool, WriteFileTool } from "./file-tools";
import { ShellTool } from "./shell-tool";
import { WebFetchTool } from "./web-fetch-tool";
import { DockerBrowserTool } from "./docker-browser-tool";

/**
 * A tool and the catalogue entry that describes it, carried together so they cannot drift.
 *
 * They were separate lists and that is the failure this type exists to make impossible: a tool in
 * the runnable list but not the catalogue is unreachable — the model is never told it exists and
 * `applyToolStep` denies it by name — while a tool in the catalogue but not the runnable list is
 * advertised and then refused, which spends a turn and reads to the model as a fault.
 */
export type ToolEntry = { readonly tool: Tool; readonly definition: ToolDefinition };

/** A tool the composition deliberately left out, and why. Never a silent omission. */
export type WithheldTool = { readonly name: ToolName; readonly reason: string };

export type AgentToolset = {
  readonly tools: readonly Tool[];
  readonly definitions: readonly ToolDefinition[];
  readonly withheld: readonly WithheldTool[];
};

export type ToolsetSettings = {
  /**
   * Tools the composition root builds itself because they need stores it owns — retrieval needs the
   * vector index and the sealed document map. They are composed unconditionally: retrieval is
   * scoped by namespace inside the tool and reaches nothing outside the tenant.
   */
  readonly retrieval: readonly ToolEntry[];
  /** Base directory holding one workspace per tenant. Never a tenant's own directory. */
  readonly workspaceBase: string;
  readonly egress: ReadonlyMap<Namespace, EgressPolicy>;
  readonly executor: CodeExecutor;
  readonly browserImage: string;
  readonly devMode: string | undefined;
};

/**
 * The browser tool is its own container, so it is gated on its own isolation rather than the code
 * executor's. Supplying a microVM executor would otherwise compose a shared-kernel browser as a
 * side effect of an unrelated upgrade, and a browser running a hostile page is the strongest case
 * for the microVM requirement rather than an exception to it
 * (implementation-plan.txt:184).
 */
const BROWSER_ISOLATION = "shared-kernel" as const;

const READ_FILE: ToolDefinition = {
  name: toolName("read_file"),
  summary: "Read a text file from this workspace.",
  schema: '{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}',
  serverId: "workspace",
};

const WRITE_FILE: ToolDefinition = {
  name: toolName("write_file"),
  summary: "Write a text file into this workspace, replacing what was there.",
  schema:
    '{"type":"object","properties":{"path":{"type":"string"},"contents":{"type":"string"}},' +
    '"required":["path","contents"]}',
  serverId: "workspace",
};

const FETCH_URL: ToolDefinition = {
  name: toolName("fetch_url"),
  summary: "Fetch a URL from the allowed-hosts list and return its body.",
  schema: '{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}',
  serverId: "egress",
};

const RENDER_PAGE: ToolDefinition = {
  name: toolName("render_page"),
  summary: "Open an allowed URL in a sandboxed browser and return the page it rendered.",
  schema: '{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}',
  serverId: "egress",
};

const RUN_SHELL: ToolDefinition = {
  name: toolName("run_shell"),
  summary: "Run a short program in the sandbox and return what it printed.",
  schema:
    '{"type":"object","properties":{"runtime":{"enum":["bash","python","node"]},' +
    '"source":{"type":"string"}},"required":["source"]}',
  serverId: "sandbox",
};

/**
 * Every tool this deployment may run, with the catalogue that describes exactly those.
 *
 * Composing the acting tools does not make them runnable. Each carries an `actionClass`, and
 * `seekApproval` treats an absent `ApprovalGate` as nobody answering — which denies on every lane
 * but the fast one. So a deployment with no reviewer wired up composes all of these and can still
 * only retrieve. That is the intended end state of this change, not a gap in it: the alternative,
 * reading "no gate configured" as "no approval needed", makes the strictest deployment the most
 * permissive one.
 */
export function agentToolset(settings: ToolsetSettings): AgentToolset {
  const entries: ToolEntry[] = [
    ...settings.retrieval,
    {
      tool: new ReadFileTool({ name: READ_FILE.name, base: settings.workspaceBase }),
      definition: READ_FILE,
    },
    {
      tool: new WriteFileTool({ name: WRITE_FILE.name, base: settings.workspaceBase }),
      definition: WRITE_FILE,
    },
    {
      tool: new WebFetchTool({ name: FETCH_URL.name, policies: settings.egress }),
      definition: FETCH_URL,
    },
  ];
  const withheld: WithheldTool[] = [];

  const shell = sandboxDecision({
    isolation: settings.executor.isolation,
    devMode: settings.devMode,
  });
  if (shell.kind === "compose") {
    entries.push({
      tool: new ShellTool({ name: RUN_SHELL.name, executor: settings.executor }),
      definition: RUN_SHELL,
    });
  } else {
    withheld.push({ name: RUN_SHELL.name, reason: shell.reason });
  }

  const browser = sandboxDecision({ isolation: BROWSER_ISOLATION, devMode: settings.devMode });
  if (browser.kind === "compose") {
    entries.push({
      tool: new DockerBrowserTool({
        name: RENDER_PAGE.name,
        image: settings.browserImage,
        policies: settings.egress,
      }),
      definition: RENDER_PAGE,
    });
  } else {
    withheld.push({ name: RENDER_PAGE.name, reason: browser.reason });
  }

  return {
    tools: entries.map((entry) => entry.tool),
    definitions: entries.map((entry) => entry.definition),
    withheld,
  };
}

/** These names are literals in this file; an unparseable one is a typo, not a runtime condition. */
function toolName(value: string): ToolName {
  const parsed = parseToolName(value);
  if (!parsed.ok) {
    throw new Error(`toolset: ${value} is not a usable tool name`);
  }
  return parsed.value;
}
