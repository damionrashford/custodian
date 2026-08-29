import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { colorMath } from "../lib/colormath.ts";

const src = readFileSync(join(import.meta.dir, "..", "knowledge", "rules", "themes.md"), "utf-8");
const CATALOG = ["Specimen", "Atelier", "Brutal", "Salon", "Newsprint", "Linen", "Studio", "Manifesto", "Terminal", "Midnight", "Almanac", "Garden", "Quiet", "Riso", "Sport", "Bloom", "Coral", "Violet", "Aurora", "Halo", "Plume", "Editorial"];

const sections = src.split(/\n## /).slice(1);
const themes = sections
  .map(t => ({
    name: t.split(" —")[0].split("\n")[0].trim(),
    toks: Object.fromEntries([...t.matchAll(/--color-([a-z0-9-]+):\s*(oklch\([^)]+\))/g)].map(m => [m[1], m[2]])),
  }))
  .filter(t => Object.keys(t.toks).length > 0);

test("all 22 catalog themes are defined with full token blocks", () => {
  expect(themes.map(t => t.name).sort()).toEqual([...CATALOG].sort());
  for (const t of themes) {
    for (const role of ["paper", "paper-2", "ink", "muted", "accent", "accent-ink", "focus"]) {
      expect(t.toks[role], `${t.name} missing --color-${role}`).toBeDefined();
    }
  }
});

test("genre membership table covers every theme exactly once", () => {
  const table = src.slice(src.indexOf("## Genre membership"), src.indexOf("\n---"));
  for (const name of CATALOG) {
    const count = [...table.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
    expect(count, `${name} appears ${count}× in the membership table`).toBeGreaterThanOrEqual(1);
  }
});

describe("every palette passes its contrast targets (WCAG 2.1 via coloraide)", () => {
  const pairs = themes.flatMap(t => [
    { name: `${t.name}:ink/paper`, fg: t.toks.ink, bg: t.toks.paper, min: 7.0 },
    { name: `${t.name}:muted/paper`, fg: t.toks.muted, bg: t.toks.paper, min: 4.5 },
    { name: `${t.name}:accent-ink/accent`, fg: t.toks["accent-ink"], bg: t.toks.accent, min: 4.5 },
    { name: `${t.name}:focus/paper`, fg: t.toks.focus, bg: t.toks.paper, min: 3.0 },
    { name: `${t.name}:ink/paper-2`, fg: t.toks.ink, bg: t.toks["paper-2"], min: 4.5 },
  ]);
  const { results } = colorMath("contrast", { pairs });
  for (const r of results) {
    test(r.name!, () => {
      expect(r.error).toBeUndefined();
      expect(r.pass, `${r.name} ratio=${r.ratio} need=${r.min}`).toBe(true);
    });
  }
});

test("theme token values snapshot (guards accidental palette drift)", () => {
  expect(Object.fromEntries(themes.map(t => [t.name, t.toks]))).toMatchSnapshot();
});
