import { expect, test } from "bun:test";
import { parseStep } from "@custodian/agent-runtime";

test("a fenced use-tool reply parses, arguments kept as opaque JSON", () => {
  const reply =
    'Sure!\n```json\n{"action":"use-tool","tool":"search_kb","arguments":{"query":"erasure"}}\n```';
  const step = parseStep(reply);
  expect(step.ok).toBe(true);
  if (!step.ok) return;
  expect(step.value.kind).toBe("use-tool");
  if (step.value.kind !== "use-tool") return;
  expect(String(step.value.tool)).toBe("search_kb");
  expect(JSON.parse(step.value.argumentsJson)).toEqual({ query: "erasure" });
});

test("an answer reply parses", () => {
  const step = parseStep('{"action":"answer","text":"Custodian is an agent platform."}');
  expect(step).toEqual({
    ok: true,
    value: { kind: "answer", text: "Custodian is an agent platform." },
  });
});

test("an unknown action is unparseable, not guessed", () => {
  expect(parseStep('{"action":"think","text":"hmm"}').ok).toBe(false);
});

test("a reply with no JSON object is unparseable", () => {
  expect(parseStep("I could not decide.").ok).toBe(false);
});

test("an answer without text is unparseable", () => {
  expect(parseStep('{"action":"answer"}').ok).toBe(false);
});

test("a tool name that fails the ToolName parser is rejected", () => {
  expect(parseStep('{"action":"use-tool","tool":"NOT A TOOL!!","arguments":{}}').ok).toBe(false);
});

test("missing arguments default to an empty object", () => {
  const step = parseStep('{"action":"use-tool","tool":"search_kb"}');
  expect(step.ok).toBe(true);
  if (!step.ok || step.value.kind !== "use-tool") return;
  expect(step.value.argumentsJson).toBe("{}");
});
