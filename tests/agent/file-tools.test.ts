import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseToolName } from "@custodian/primitives";
import { ReadFileTool, WriteFileTool } from "@custodian/agent";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const READ = must(parseToolName("read_file"), "tool name");
const WRITE = must(parseToolName("write_file"), "tool name");

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "custodian-ws-"));
}

test("a write then a read round-trips through the workspace", async () => {
  const root = workspace();
  const written = await new WriteFileTool({ name: WRITE, root }).execute(
    JSON.stringify({ path: "notes/today.md", contents: "hello" }),
  );
  if (!written.ok || written.value.kind !== "acted") throw new Error("write failed");
  expect(written.value.receipt.summary).toContain("Wrote 5 bytes");

  const read = await new ReadFileTool({ name: READ, root }).execute(
    JSON.stringify({ path: "notes/today.md" }),
  );
  if (!read.ok || read.value.kind !== "acted") throw new Error("read failed");
  expect(read.value.receipt.output).toBe("hello");
});

test("neither tool can touch anything outside the workspace", async () => {
  const root = workspace();
  const escape = JSON.stringify({ path: "../../../../etc/passwd", contents: "x" });

  const read = await new ReadFileTool({ name: READ, root }).execute(escape);
  expect(read.ok ? "allowed" : read.error.reason).toBe("path-escapes-workspace");

  const write = await new WriteFileTool({ name: WRITE, root }).execute(escape);
  expect(write.ok ? "allowed" : write.error.reason).toBe("path-escapes-workspace");

  // And the file it aimed at is untouched, which is the assertion that would catch a check that
  // reported a refusal after already having written.
  expect(await Bun.file("/etc/passwd").text()).not.toContain("\nx");
});

test("a missing file is reported, not treated as an error", async () => {
  const read = await new ReadFileTool({ name: READ, root: workspace() }).execute(
    JSON.stringify({ path: "nothing.md" }),
  );
  if (!read.ok || read.value.kind !== "acted") throw new Error("read failed");
  // A model told "the tool failed" retries; told "there is no such file" it moves on.
  expect(read.value.receipt.summary).toContain("No file at");
});

test("a large file is truncated and says so", async () => {
  const root = workspace();
  await Bun.write(join(root, "big.txt"), "x".repeat(100 * 1024));

  const read = await new ReadFileTool({ name: READ, root }).execute(
    JSON.stringify({ path: "big.txt" }),
  );
  if (!read.ok || read.value.kind !== "acted") throw new Error("read failed");
  expect(read.value.receipt.output.length).toBe(64 * 1024);
  expect(read.value.receipt.summary).toContain("larger");
});

test("an oversized write is refused before it reaches the disk", async () => {
  const root = workspace();
  const write = await new WriteFileTool({ name: WRITE, root }).execute(
    JSON.stringify({ path: "big.txt", contents: "x".repeat(300 * 1024) }),
  );
  expect(write.ok).toBe(false);
  expect(await Bun.file(join(root, "big.txt")).exists()).toBe(false);
});

test("the write tool takes the high-assurance lane, the read tool does not", () => {
  // The model does not get to grade its own action: the class is on the tool.
  expect(new WriteFileTool({ name: WRITE, root: "/tmp" }).actionClass).toBe(
    "financial-or-irreversible",
  );
  expect(new ReadFileTool({ name: READ, root: "/tmp" }).actionClass).toBe("sensitive-data-access");
});

test("malformed arguments are refused", async () => {
  const tool = new ReadFileTool({ name: READ, root: workspace() });
  expect((await tool.execute("not json")).ok).toBe(false);
  expect((await tool.execute('{"wrong":"key"}')).ok).toBe(false);
});
