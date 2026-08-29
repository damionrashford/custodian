#!/usr/bin/env bun
/**
 * drift-diff.ts — Diff baseline brand.json vs a current draft. Writes a markdown report.
 *
 * Usage:
 *   bun drift-diff.ts --baseline design/design.json --current design/drafts/drift-...json --output design/reports/drift-...md
 *
 * Per category:
 *   - color: CIEDE2000 ΔE per matched role via color-math.py (ΔE ≥ 5 = noteworthy on the
 *     standard 0–100 scale). Works on any CSS color syntax.
 *   - others: value diff, new tokens, removed tokens
 *
 * Exit 0 ok · 1 IO · 2 bad args.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { colorMath } from "../../lib/colormath.js";

const argv = Bun.argv.slice(2);
const args: { baseline?: string; current?: string; output?: string } = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--baseline") args.baseline = argv[++i];
  else if (a === "--current") args.current = argv[++i];
  else if (a === "--output") args.output = argv[++i];
  else if (a === "-h" || a === "--help") {
    console.log("Usage: bun drift-diff.ts --baseline <path> --current <path> --output <path>");
    process.exit(0);
  }
}
if (!args.baseline || !args.current || !args.output) {
  console.error("--baseline, --current, --output all required"); process.exit(2);
}
function readJson(path: string): any {
  const p = resolve(path);
  if (!existsSync(p)) { console.error(`Not found: ${p}`); process.exit(1); }
  try { return JSON.parse(readFileSync(p, "utf-8")); }
  catch (e) { console.error(`Invalid JSON in ${p}: ${(e as Error).message}`); process.exit(1); }
}
const baseline = readJson(args.baseline);
const current  = readJson(args.current);

const sections: string[] = [];
sections.push(`# Brand drift report

- **Baseline:** \`${args.baseline}\` (last updated ${baseline.updated_at ?? "unknown"})
- **Current:** \`${args.current}\` (fetched ${current.fetched_at ?? "unknown"})
- **Source URL:** ${current.source_url ?? baseline.source_url ?? "n/a"}
- **Extraction mode:** baseline=${baseline.extraction_mode ?? "fast"} · current=${current.extraction_mode ?? "fast"}
${baseline.extraction_mode !== current.extraction_mode ? "  - ⚠ MODE MISMATCH — diff may show false drift from path differences, not real changes." : ""}
`);

// Color drift
sections.push("## Color drift\n");
const baseColors = new Map((baseline.tokens?.color ?? []).map((t: any) => [t.role, t]));
const currColors = new Map((current.tokens?.color  ?? []).map((t: any) => [t.role, t]));
const colorRows: string[] = ["| Role | Baseline | Current | ΔE2000 | Note |", "|---|---|---|---|---|"];

// ΔE2000 via the coloraide authority — one batched subprocess. Thresholds are on the
// standard CIEDE2000 0–100 scale: <1 imperceptible, <5 minor, <15 noteworthy, ≥15 major.
const matched: Array<{ role: string; base: any; curr: any }> = [];
for (const [role, baseTok] of baseColors) {
  const currTok = currColors.get(role);
  if (currTok) matched.push({ role: role as string, base: baseTok, curr: currTok });
}
let deltas: Array<{ delta?: number; error?: string }> = [];
if (matched.length > 0) {
  try {
    deltas = colorMath("deltae", { pairs: matched.map(m => ({ a: m.base.value, b: m.curr.value })) }).results;
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
const deltaByRole = new Map(matched.map((m, i) => [m.role, deltas[i]]));

for (const [role, baseTok] of baseColors) {
  const currTok = currColors.get(role);
  if (!currTok) {
    colorRows.push(`| ${role} | \`${(baseTok as any).value}\` | — | — | REMOVED |`);
    continue;
  }
  const d = deltaByRole.get(role as string);
  const de = d?.delta;
  const deStr = de === undefined ? "—" : de.toFixed(2);
  const note = de === undefined ? "unparseable" : de < 1 ? "identical" : de < 5 ? "minor" : de < 15 ? "noteworthy" : "major";
  colorRows.push(`| ${role} | \`${(baseTok as any).value}\` | \`${(currTok as any).value}\` | ${deStr} | ${note} |`);
}
for (const [role, currTok] of currColors) {
  if (!baseColors.has(role)) {
    colorRows.push(`| ${role} | — | \`${(currTok as any).value}\` | — | NEW |`);
  }
}
sections.push(colorRows.join("\n") + "\n");

for (const cat of ["typography", "spacing", "text_scale", "motion", "depth"] as const) {
  sections.push(`## ${cat[0].toUpperCase()}${cat.slice(1)} drift\n`);
  const baseMap = new Map((baseline.tokens?.[cat] ?? []).map((t: any) => [t.role, t]));
  const currMap = new Map((current.tokens?.[cat]  ?? []).map((t: any) => [t.role, t]));
  const rows: string[] = ["| Role | Baseline | Current | Change |", "|---|---|---|---|"];
  for (const [role, baseTok] of baseMap) {
    const currTok = currMap.get(role);
    if (!currTok) { rows.push(`| ${role} | \`${(baseTok as any).value}\` | — | REMOVED |`); continue; }
    const changed = (baseTok as any).value !== (currTok as any).value;
    rows.push(`| ${role} | \`${(baseTok as any).value}\` | \`${(currTok as any).value}\` | ${changed ? "changed" : "—"} |`);
  }
  for (const [role, currTok] of currMap) {
    if (!baseMap.has(role)) rows.push(`| ${role} | — | \`${(currTok as any).value}\` | NEW |`);
  }
  sections.push(rows.join("\n") + "\n");
}

sections.push("## Coverage flags delta\n");
sections.push("```json");
sections.push(JSON.stringify({ baseline: baseline.coverage_flags, current: current.coverage_flags }, null, 2));
sections.push("```\n");

sections.push("## Confidence delta\n");
sections.push(`- baseline_global: ${baseline.confidence_global ?? "n/a"}`);
sections.push(`- current_global:  ${current.confidence_global ?? "n/a"}`);
sections.push(`- delta:           ${((current.confidence_global ?? 0) - (baseline.confidence_global ?? 0)).toFixed(3)}\n`);

writeFileSync(resolve(args.output), sections.join("\n"));
console.log(JSON.stringify({ ok: true, output: args.output, source: current.source_url }, null, 2));
