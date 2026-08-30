import { expect, test } from "bun:test";
import {
  InMemoryToolCatalogue,
  parseTaskClass,
  type ToolDefinition,
} from "@custodian/tool-registry";
import { parseToolName } from "@custodian/domain-primitives";

function name(value: string) {
  const parsed = parseToolName(value);
  if (!parsed.ok) throw new Error(`fixture: bad tool name ${value}`);
  return parsed.value;
}

function taskClass(value: string) {
  const parsed = parseTaskClass(value);
  if (!parsed.ok) throw new Error(`fixture: bad task class ${value}`);
  return parsed.value;
}

const SEARCH: ToolDefinition = {
  name: name("search_documents"),
  summary: "Find documents in the tenant knowledge base.",
  schema: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}',
  serverId: "knowledge",
};

const REFUND: ToolDefinition = {
  name: name("issue_refund"),
  summary: "Refund a payment to the original method.",
  schema: '{"type":"object","properties":{"orderId":{"type":"string"}},"required":["orderId"]}',
  serverId: "billing",
};

function catalogue() {
  return new InMemoryToolCatalogue({
    definitions: [SEARCH, REFUND],
    allowlists: new Map([
      [taskClass("support"), [SEARCH.name]],
      [taskClass("finance"), [SEARCH.name, REFUND.name]],
    ]),
  });
}

test("the index carries names and summaries but never schemas", async () => {
  const listed = await catalogue().index(taskClass("finance"));
  expect(listed.ok).toBe(true);
  if (!listed.ok) return;

  expect(listed.value).toEqual([
    { name: SEARCH.name, summary: SEARCH.summary },
    { name: REFUND.name, summary: REFUND.summary },
  ]);
  expect(JSON.stringify(listed.value)).not.toContain("properties");
});

test("the index is scoped by task class, not by whole server", async () => {
  const listed = await catalogue().index(taskClass("support"));
  if (!listed.ok) throw new Error("index failed");

  expect(listed.value.map((entry) => entry.name)).toEqual([SEARCH.name]);
});

test("a full definition loads only when the model reaches for it", async () => {
  const defined = await catalogue().define(taskClass("finance"), REFUND.name);
  expect(defined).toEqual({ ok: true, value: REFUND });
});

test("a tool outside the task class allowlist cannot be defined, only unlisted", async () => {
  const defined = await catalogue().define(taskClass("support"), REFUND.name);
  expect(defined).toEqual({
    ok: false,
    error: { kind: "tool-not-in-scope", name: REFUND.name },
  });
});

test("an unknown tool is an error, not an empty definition", async () => {
  const defined = await catalogue().define(taskClass("finance"), name("delete_everything"));
  expect(defined).toEqual({
    ok: false,
    error: { kind: "tool-not-in-scope", name: name("delete_everything") },
  });
});

test("the loaded index costs far less than the full catalogue", async () => {
  const listed = await catalogue().index(taskClass("finance"));
  if (!listed.ok) throw new Error("index failed");

  const preloaded = JSON.stringify([SEARCH, REFUND]).length;
  const progressive = JSON.stringify(listed.value).length;
  expect(progressive).toBeLessThan(preloaded);
});
