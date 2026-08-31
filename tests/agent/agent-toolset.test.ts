import { expect, test } from "bun:test";
import { parseTenantId, parseToolName, type Namespace, type ToolName } from "@custodian/primitives";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge";
import { seekApproval } from "@custodian/governance";
import {
  agentToolset,
  type AgentToolset,
  type CodeExecutor,
  type EgressPolicy,
  type Tool,
  type ToolEntry,
} from "@custodian/agent";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

function namespaceOf(id: string): Namespace {
  const tenant = must(parseTenantId(id), "tenant");
  const verifier: ClaimVerifier = {
    verify: () => ({
      ok: true,
      value: {
        tenant,
        issuedAt: "2026-08-29T23:45:00.000Z",
        expiresAt: "2026-08-30T00:15:00.000Z",
      },
    }),
  };
  const claim = verifyTenantClaim("signed", {
    verifier,
    now: new Date("2026-08-30T00:00:00.000Z"),
  });
  if (!claim.ok) throw new Error("fixture: claim rejected");
  return namespaceFor(claim.value);
}

const ACME = namespaceOf("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
const SEARCH = must(parseToolName("search_kb"), "tool name");
const AT = "2026-08-30T00:00:00.000Z";

const retrieval: ToolEntry = {
  tool: {
    name: SEARCH,
    actionClass: "low-risk-reversible",
    execute: () => Promise.resolve({ ok: true, value: { kind: "retrieved", retrieved: [] } }),
  },
  definition: {
    name: SEARCH,
    summary: "Search the workspace knowledge base.",
    schema: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}',
    serverId: "kb",
  },
};

function executor(isolation: CodeExecutor["isolation"]): CodeExecutor {
  return {
    isolation,
    execute: () =>
      Promise.resolve({
        ok: true,
        value: { exitCode: 0, stdout: "", stderr: "", truncated: false },
      }),
  };
}

function toolset(settings: {
  readonly isolation?: CodeExecutor["isolation"];
  readonly devMode?: string;
  readonly egress?: ReadonlyMap<Namespace, EgressPolicy>;
}): AgentToolset {
  return agentToolset({
    retrieval: [retrieval],
    workspaceBase: "/tmp/custodian-toolset",
    egress: settings.egress ?? new Map<Namespace, EgressPolicy>(),
    executor: executor(settings.isolation ?? "shared-kernel"),
    browserImage: "chromium",
    devMode: settings.devMode,
  });
}

function names(composed: AgentToolset): string[] {
  return composed.tools.map((tool) => String(tool.name));
}

test("the sandboxed tools are withheld outside development, and say so", () => {
  const composed = toolset({});

  // Shared-kernel containers are not defensible for untrusted agent code
  // (AI_Agent_Implementation_Plan_v2.txt:184). Composing them anyway and hoping nobody calls them
  // is the failure `sandboxDecision` exists to prevent.
  expect(names(composed)).not.toContain("run_shell");
  expect(names(composed)).not.toContain("render_page");
  expect(composed.withheld.map((item) => String(item.name)).sort()).toEqual([
    "render_page",
    "run_shell",
  ]);
  // Withheld, never silently dropped: a composition missing a tool for a reason and one missing it
  // by accident look identical, and the fix applied to the second is to wire it in unguarded.
  for (const item of composed.withheld) {
    expect(item.reason.length).toBeGreaterThan(0);
  }
});

test("acknowledged development mode composes the sandboxed tools", () => {
  const composed = toolset({ devMode: "1" });
  expect(names(composed)).toContain("run_shell");
  expect(names(composed)).toContain("render_page");
  expect(composed.withheld).toEqual([]);
});

test("a microVM executor composes the shell but not the browser", () => {
  // The browser is its own shared-kernel container. Gating it on the executor's isolation would let
  // an unrelated executor upgrade compose a browser nobody assessed.
  const composed = toolset({ isolation: "microvm" });
  expect(names(composed)).toContain("run_shell");
  expect(names(composed)).not.toContain("render_page");
  expect(composed.withheld.map((item) => String(item.name))).toEqual(["render_page"]);
});

test("the catalogue and the runnable set are the same tools, in the same order", () => {
  // Two lists is how a tool becomes advertised-and-denied, or held-and-unreachable. Neither shows
  // up in a diff; both cost a turn and read to the model as a fault.
  for (const composed of [toolset({}), toolset({ devMode: "1" })]) {
    expect(composed.definitions.map((definition) => String(definition.name))).toEqual(
      names(composed),
    );
  }
});

test("retrieval is composed whatever the sandbox decides", () => {
  expect(names(toolset({}))).toContain("search_kb");
  expect(names(toolset({ devMode: "1" }))).toContain("search_kb");
});

test("every acting tool is still refused when no reviewer is configured", async () => {
  // Composition is not permission. `seekApproval` reads an absent gate as nobody answering, which
  // denies every lane but the fast one — so this deployment holds the acting tools and can only
  // retrieve until a reviewer exists. Weakening this is how an agent starts writing files unasked.
  const composed = toolset({ devMode: "1" });
  const acting = composed.tools.filter((tool) => tool.name !== SEARCH);
  expect(acting.length).toBeGreaterThan(0);

  const resolutions = await Promise.all(
    acting.map((tool) => seekApproval(tool.actionClass, undefined, AT)),
  );
  expect(resolutions).toEqual(
    acting.map(() => ({ kind: "denied", reason: "timed-out-fail-safe" })),
  );
});

test("the composed egress allowlist is empty, so the fetch tool reaches nothing", async () => {
  const composed = toolset({});
  const fetchUrl = byName(composed.tools, "fetch_url");

  // Deny-by-default, and the refusal lands before DNS — the check that costs nothing and leaks
  // nothing (Test_and_Security_Assurance.txt:95).
  const refused = await fetchUrl.execute('{"url":"https://example.com/"}', ACME);
  expect(refused.ok ? "allowed" : refused.error.reason).toBe("host-not-allowlisted");
});

test("a tenant with no allowlist entry reaches nothing even when another tenant has one", async () => {
  const other = namespaceOf("t_02jd7k9h2m4n6p8r0s2t4v6x8z");
  const composed = toolset({
    egress: new Map<Namespace, EgressPolicy>([[ACME, { allowedHosts: ["example.com"] }]]),
  });
  const fetchUrl = byName(composed.tools, "fetch_url");

  // One tenant's approved destination must not become every tenant's. A single shared policy would
  // pass every test above and fail exactly here.
  const refused = await fetchUrl.execute('{"url":"https://example.com/"}', other);
  expect(refused.ok ? "allowed" : refused.error.reason).toBe("host-not-allowlisted");
});

function byName(tools: readonly Tool[], name: string): Tool {
  const found = tools.find((tool) => String(tool.name) === name);
  if (found === undefined) throw new Error(`fixture: ${name} was not composed`);
  return found;
}

test("tool names are the ones the catalogue advertises", () => {
  const composed = toolset({ devMode: "1" });
  const advertised: ToolName[] = composed.definitions.map((definition) => definition.name);
  expect(advertised.map(String).sort()).toEqual([
    "fetch_url",
    "read_file",
    "render_page",
    "run_shell",
    "search_kb",
    "write_file",
  ]);
});
