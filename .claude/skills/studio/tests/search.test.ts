import { test, expect } from "bun:test";
import { join } from "node:path";

const S = join(import.meta.dir, "..");
const search = (args: string[]) => {
  const proc = Bun.spawnSync(["bun", join(S, "scripts/library/search.ts"), ...args], { stdout: "pipe", stderr: "pipe" });
  return { code: proc.exitCode, out: new TextDecoder().decode(proc.stdout), err: new TextDecoder().decode(proc.stderr) };
};

test("bm25 finds rule content", () => {
  const r = search(["focus ring", "--mode", "bm25", "--limit", "3"]);
  expect(r.code).toBe(0);
  const d = JSON.parse(r.out);
  expect(d.matches.length).toBeGreaterThan(0);
});

test("--domain rules restricts to the rules corpus", () => {
  const r = search(["contrast", "--domain", "rules", "--mode", "bm25", "--limit", "5"]);
  expect(r.code).toBe(0);
  const d = JSON.parse(r.out);
  for (const m of d.matches) expect(m.domain).toBe("rules");
});

test("hybrid returns results even with Ollama available or not (never crashes)", () => {
  const r = search(["typographic hierarchy", "--mode", "hybrid", "--limit", "3"]);
  expect(r.code).toBe(0);
  expect(JSON.parse(r.out).matches.length).toBeGreaterThan(0);
});

test("bad --domain exits 2 with the valid list", () => {
  const r = search(["x", "--domain", "nope"]);
  expect(r.code).toBe(2);
  expect(r.err).toContain("--domain must be one of");
});

test("invalid --limit is rejected, not silently NaN'd", () => {
  const r = search(["x", "--limit", "abc"]);
  expect(r.code).toBe(2);
});
