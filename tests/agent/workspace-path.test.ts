import { expect, test } from "bun:test";
import { safePath } from "@custodian/agent";

const ROOT = "/srv/workspace";

test("an ordinary relative path resolves inside the workspace", () => {
  const resolved = safePath(ROOT, "notes/today.md");
  expect(resolved.ok && String(resolved.value)).toBe("/srv/workspace/notes/today.md");
});

test("traversal is refused however it is spelled", () => {
  // Not by looking for "..", which is the version of this check that gets bypassed: the first two
  // contain it and are fine after two segments, the encoded one does not contain it at all.
  for (const attempt of [
    "../etc/passwd",
    "notes/../../etc/passwd",
    "%2e%2e/%2e%2e/etc/passwd",
    "notes/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
    "./../../etc/passwd",
  ]) {
    const resolved = safePath(ROOT, attempt);
    expect([attempt, resolved.ok ? "allowed" : resolved.error.kind]).toEqual([
      attempt,
      "path-escapes-workspace",
    ]);
  }
});

test("an interior traversal that stays inside is allowed", () => {
  // Refusing this would be wrong: it never leaves, and a tool that rejects legitimate paths gets
  // worked around rather than trusted.
  const resolved = safePath(ROOT, "notes/drafts/../today.md");
  expect(resolved.ok && String(resolved.value)).toBe("/srv/workspace/notes/today.md");
});

test("an absolute path is refused rather than quietly reinterpreted", () => {
  // Treating it as relative would answer a different question than the one asked, and the model
  // would then reason about a file it did not read.
  const resolved = safePath(ROOT, "/etc/passwd");
  expect(resolved.ok ? "allowed" : resolved.error.kind).toBe("path-absolute");
  const windows = safePath(ROOT, "C:\\Windows\\System32\\config\\SAM");
  expect(windows.ok ? "allowed" : windows.error.kind).toBe("path-absolute");
});

test("a NUL byte cannot truncate the path at the syscall", () => {
  // What the checker sees and what the kernel opens would otherwise be different strings.
  const resolved = safePath(ROOT, "notes/ok\u0000/../../../etc/passwd");
  expect(resolved.ok).toBe(false);
});

test("empty and oversized paths are refused", () => {
  expect(safePath(ROOT, "").ok).toBe(false);
  expect(safePath(ROOT, "a".repeat(600)).ok).toBe(false);
});
