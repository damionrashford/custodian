import { test, expect, beforeAll } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const S = join(import.meta.dir, "..");
const run = (script: string, args: string[], cwd: string) => {
  const proc = Bun.spawnSync(["bun", join(S, script), ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return { code: proc.exitCode, out: new TextDecoder().decode(proc.stdout), err: new TextDecoder().decode(proc.stderr) };
};

const W = mkdtempSync(join(tmpdir(), "studio-pipeline-test-"));
const tok = (name: string, value: string, category: string, role: string, confidence = 0.9) =>
  ({ name, value, category, role, provenance: { source_type: "manual" }, confidence });
const draft = {
  $schema: "https://github.com/damionrashford/design-system/schema/0.2.0",
  schema_version: "0.2.0", source_url: "manual:test", updated_at: "2026-01-01T00:00:00.000Z",
  tokens: {
    color: [
      tok("bg", "oklch(97.5% 0.004 80)", "color", "bg"),
      tok("fg", "oklch(22% 0.01 80)", "color", "fg"),
      tok("primary", "oklch(52% 0.19 27)", "color", "primary"),
      tok("accent", "oklch(70% 0.15 40)", "color", "accent"),
    ],
    typography: [tok("font-display", "Fraunces", "typography", "display")],
    spacing: [tok("space-md", "1rem", "spacing", "md")],
    text_scale: [], motion: [tok("dur-short", "220ms", "motion", "dur_short")], depth: [],
  },
  derived: { states: {}, contrast: [] },
  coverage_flags: { js_rendered: false, css_in_js_likely: false, theme_variants_found: [], responsive_variants_found: [] },
  confidence_global: 0.9, extraction_mode: "fast", history: [],
};

beforeAll(() => {
  mkdirSync(join(W, "out"));
  writeFileSync(join(W, "draft.json"), JSON.stringify(draft));
});

test("init scaffolds a store that validates", () => {
  expect(run("scripts/design/init.ts", ["--dir", "design"], W).code).toBe(0);
  expect(run("scripts/design/validate.ts", ["--brand", "design/design.json"], W).code).toBe(0);
});

test("merge → derive → contrast → validate all green on a sound draft", () => {
  expect(run("scripts/design/merge.ts", ["--drafts", "draft.json", "--output", "design/design.json"], W).code).toBe(0);
  expect(run("scripts/design/derive-states.ts", ["--brand", "design/design.json", "--in-place"], W).code).toBe(0);
  const contrast = run("scripts/design/contrast-check.ts", ["--brand", "design/design.json", "--level", "AA"], W);
  expect(contrast.code).toBe(0);   // this palette is designed to pass
  expect(run("scripts/design/validate.ts", ["--brand", "design/design.json"], W).code).toBe(0);
  const brand = JSON.parse(readFileSync(join(W, "design/design.json"), "utf-8"));
  for (const t of brand.tokens.color) expect(t.value.startsWith("oklch(")).toBe(true);   // OKLCH-only invariant
});

test("contrast-check fails (exit 3) on a genuinely bad pair", () => {
  const bad = structuredClone(draft);
  bad.tokens.color.push(tok("primary-fg", "oklch(55% 0.18 27)", "color", "primary-fg"));
  writeFileSync(join(W, "bad.json"), JSON.stringify(bad));
  expect(run("scripts/design/contrast-check.ts", ["--brand", "bad.json"], W).code).toBe(3);
});

test("merge folds legacy radius/shadow categories into depth", () => {
  const legacy = structuredClone(draft) as any;
  legacy.tokens.radius = [tok("radius-md", "8px", "radius", "md")];
  legacy.tokens.shadow = [tok("shadow-md", "0 1px 2px oklch(20% 0.01 250 / 0.05)", "shadow", "md")];
  writeFileSync(join(W, "legacy.json"), JSON.stringify(legacy));
  expect(run("scripts/design/merge.ts", ["--drafts", "legacy.json", "--output", "legacy-merged.json"], W).code).toBe(0);
  const merged = JSON.parse(readFileSync(join(W, "legacy-merged.json"), "utf-8"));
  const depthRoles = merged.tokens.depth.map((t: any) => t.role);
  expect(depthRoles).toContain("radius-md");
  expect(depthRoles).toContain("shadow-md");
  expect(run("scripts/design/validate.ts", ["--brand", "legacy-merged.json"], W).code).toBe(0);
});

test("export emits no leftover placeholders or empty declarations", () => {
  const r = run("scripts/design/export.ts", ["--brand", "design/design.json", "--format", "tailwind-v4", "--output", "out/app.css"], W);
  expect(r.code).toBe(0);
  const css = readFileSync(join(W, "out/app.css"), "utf-8");
  expect(css).not.toContain("{{");
  expect(css).not.toMatch(/:\s*;/);
});

test("drift-diff reports identical colors as identical", () => {
  mkdirSync(join(W, "design/reports"), { recursive: true });
  const r = run("scripts/design/drift-diff.ts", ["--baseline", "design/design.json", "--current", "design/design.json", "--output", "design/reports/drift.md"], W);
  expect(r.code).toBe(0);
  const md = readFileSync(join(W, "design/reports/drift.md"), "utf-8");
  expect(md).toContain("identical");
  expect(md).not.toContain("| major |");
});

test("cleanup", () => { rmSync(W, { recursive: true, force: true }); });
