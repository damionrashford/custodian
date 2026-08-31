import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTenantId, parseToolName, type Namespace } from "@custodian/primitives";
import { namespaceFor, verifyTenantClaim, type ClaimVerifier } from "@custodian/knowledge";
import { ReadFileTool, workspaceRoot, WriteFileTool } from "@custodian/agent";

function must<T>(parsed: { ok: true; value: T } | { ok: false }, label: string): T {
  if (!parsed.ok) throw new Error(`fixture: bad ${label}`);
  return parsed.value;
}

const READ = must(parseToolName("read_file"), "tool name");
const WRITE = must(parseToolName("write_file"), "tool name");

/**
 * A namespace can only be minted from a verified claim, which is the guarantee under test, so the
 * fixture verifies one rather than reaching for an escape hatch that deliberately does not exist.
 */
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
const OTHER = namespaceOf("t_02jd7k9h2m4n6p8r0s2t4v6x8z");

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "custodian-ws-"));
}

test("a write then a read round-trips through the workspace", async () => {
  const base = workspace();
  const written = await new WriteFileTool({ name: WRITE, base }).execute(
    JSON.stringify({ path: "notes/today.md", contents: "hello" }),
    ACME,
  );
  if (!written.ok || written.value.kind !== "acted") throw new Error("write failed");
  expect(written.value.receipt.summary).toContain("Wrote 5 bytes");

  const read = await new ReadFileTool({ name: READ, base }).execute(
    JSON.stringify({ path: "notes/today.md" }),
    ACME,
  );
  if (!read.ok || read.value.kind !== "acted") throw new Error("read failed");
  expect(read.value.receipt.output).toBe("hello");
});

test("one tenant cannot read another's file through the same composed tool", async () => {
  // The tools are composed once and serve every tenant, so the root has to be a function of the
  // namespace the run arrived with. Composed against a finished root instead, this reads "secret".
  const base = workspace();
  const write = new WriteFileTool({ name: WRITE, base });
  const read = new ReadFileTool({ name: READ, base });

  const stored = await write.execute(
    JSON.stringify({ path: "notes.md", contents: "secret" }),
    ACME,
  );
  if (!stored.ok) throw new Error("write failed");

  const own = await read.execute(JSON.stringify({ path: "notes.md" }), ACME);
  const foreign = await read.execute(JSON.stringify({ path: "notes.md" }), OTHER);
  if (!own.ok || own.value.kind !== "acted") throw new Error("read failed");
  if (!foreign.ok || foreign.value.kind !== "acted") throw new Error("read failed");

  expect(own.value.receipt.output).toBe("secret");
  expect(foreign.value.receipt.output).toBe("");
  expect(foreign.value.receipt.summary).toContain("No file at");
});

test("a write lands under the run's namespace, not under the base", async () => {
  const base = workspace();
  const written = await new WriteFileTool({ name: WRITE, base }).execute(
    JSON.stringify({ path: "notes.md", contents: "hello" }),
    ACME,
  );
  if (!written.ok) throw new Error("write failed");

  expect(await Bun.file(join(workspaceRoot(base, ACME), "notes.md")).exists()).toBe(true);
  expect(await Bun.file(join(base, "notes.md")).exists()).toBe(false);
});

test("neither tool can touch anything outside the workspace", async () => {
  const base = workspace();
  const escape = JSON.stringify({ path: "../../../../etc/passwd", contents: "x" });

  const read = await new ReadFileTool({ name: READ, base }).execute(escape, ACME);
  expect(read.ok ? "allowed" : read.error.reason).toBe("path-escapes-workspace");

  const write = await new WriteFileTool({ name: WRITE, base }).execute(escape, ACME);
  expect(write.ok ? "allowed" : write.error.reason).toBe("path-escapes-workspace");

  // And the file it aimed at is untouched, which is the assertion that would catch a check that
  // reported a refusal after already having written.
  expect(await Bun.file("/etc/passwd").text()).not.toContain("\nx");
});

test("a missing file is reported, not treated as an error", async () => {
  const read = await new ReadFileTool({ name: READ, base: workspace() }).execute(
    JSON.stringify({ path: "nothing.md" }),
    ACME,
  );
  if (!read.ok || read.value.kind !== "acted") throw new Error("read failed");
  // A model told "the tool failed" retries; told "there is no such file" it moves on.
  expect(read.value.receipt.summary).toContain("No file at");
});

test("a large file is truncated and says so", async () => {
  const base = workspace();
  await Bun.write(join(workspaceRoot(base, ACME), "big.txt"), "x".repeat(100 * 1024));

  const read = await new ReadFileTool({ name: READ, base }).execute(
    JSON.stringify({ path: "big.txt" }),
    ACME,
  );
  if (!read.ok || read.value.kind !== "acted") throw new Error("read failed");
  expect(read.value.receipt.output.length).toBe(64 * 1024);
  expect(read.value.receipt.summary).toContain("larger");
});

test("an oversized write is refused before it reaches the disk", async () => {
  const base = workspace();
  const write = await new WriteFileTool({ name: WRITE, base }).execute(
    JSON.stringify({ path: "big.txt", contents: "x".repeat(300 * 1024) }),
    ACME,
  );
  expect(write.ok).toBe(false);
  expect(await Bun.file(join(workspaceRoot(base, ACME), "big.txt")).exists()).toBe(false);
});

test("the write tool takes the high-assurance lane, the read tool does not", () => {
  // The model does not get to grade its own action: the class is on the tool.
  expect(new WriteFileTool({ name: WRITE, base: "/tmp" }).actionClass).toBe(
    "financial-or-irreversible",
  );
  expect(new ReadFileTool({ name: READ, base: "/tmp" }).actionClass).toBe("sensitive-data-access");
});

test("malformed arguments are refused", async () => {
  const tool = new ReadFileTool({ name: READ, base: workspace() });
  expect((await tool.execute("not json", ACME)).ok).toBe(false);
  expect((await tool.execute('{"wrong":"key"}', ACME)).ok).toBe(false);
});
