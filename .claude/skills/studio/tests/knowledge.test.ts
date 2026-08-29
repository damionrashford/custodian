import { test, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, normalize } from "node:path";

const S = join(import.meta.dir, "..");
const read = (p: string) => readFileSync(join(S, p), "utf-8");

test("no broken markdown links anywhere in SKILL.md or knowledge/", () => {
  const bad: string[] = [];
  const check = (path: string) => {
    const dir = dirname(join(S, path));
    for (const m of read(path).matchAll(/\]\(([^)#\s]+?)(?:#[^)]*)?\)/g)) {
      const t = m[1];
      if (t.startsWith("http") || t.startsWith("mailto:")) continue;
      if (!existsSync(normalize(join(dir, t)))) bad.push(`${path} -> ${t}`);
    }
  };
  const walk = (rel: string) => {
    for (const e of readdirSync(join(S, rel), { withFileTypes: true })) {
      if (e.isDirectory()) { if (e.name !== "books") walk(join(rel, e.name)); }
      else if (e.name.endsWith(".md")) check(join(rel, e.name));
    }
  };
  walk("knowledge");
  check("SKILL.md");
  expect(bad).toEqual([]);
});

test("slop test declares 71 gates and numbers them 1..71 with no gaps", () => {
  const s = read("knowledge/playbooks/slop-test.md");
  expect(s).toContain("71 gates");
  const nums = [...s.matchAll(/^(\d+)\. /gm)].map(m => Number(m[1]));
  expect(new Set(nums).size).toBe(71);
  expect(Math.min(...nums)).toBe(1);
  expect(Math.max(...nums)).toBe(71);
});

test("critique checklist has exactly 23 numbered checks and says so", () => {
  const s = read("knowledge/playbooks/critique-checklist.md");
  expect(s).toContain("23-point");
  const nums = [...s.matchAll(/^(\d+)\. \*\*/gm)].map(m => Number(m[1]));
  expect(new Set(nums).size).toBe(23);
  expect(Math.max(...nums)).toBe(23);
});

test("21 macrostructure files exist and every index entry resolves", () => {
  const files = readdirSync(join(S, "knowledge/playbooks/macrostructures")).filter(f => f.endsWith(".md"));
  expect(files.length).toBe(21);
});

test("46 component files exist", () => {
  const files = readdirSync(join(S, "knowledge/playbooks/components")).filter(f => f.endsWith(".md"));
  expect(files.length).toBe(46);
});

test("every rules .md has a search-corpus .json twin (and vice versa)", () => {
  const dir = join(S, "knowledge/rules");
  const md = readdirSync(dir).filter(f => f.endsWith(".md")).map(f => f.replace(/\.md$/, ""));
  const json = readdirSync(dir).filter(f => f.endsWith(".json") && !f.endsWith(".embeddings.json")).map(f => f.replace(/\.json$/, ""));
  expect(md.sort()).toEqual(json.sort());
});

test("the 9-state canon is consistent across its three authorities", () => {
  expect(read("knowledge/rules/interaction-states.md")).toContain("nine states");
  expect(read("knowledge/playbooks/slop-test.md")).toContain("Nine states is the canon");
  expect(read("SKILL.md")).toContain("9 interaction states");
});
