#!/usr/bin/env bun
/**
 * contrast-check.ts — WCAG contrast validation on every required token pair in design.json.
 *
 * Math authority: scripts/design/color-math.py (coloraide, WCAG 2.1). This script
 * owns pair policy, exit codes, and write-back; it computes nothing itself.
 *
 * Usage:
 *   bun contrast-check.ts --brand design/design.json [--level AA|AAA] [--write-back]
 *
 * Exit codes:
 *   0  all required pairs pass
 *   3  one or more pairs fail (stderr lists failures with achieved + required ratios)
 *   2  bad args
 *   1  IO / parse error
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { colorMath } from "../../lib/colormath.js";

interface Token { name: string; value: string; role: string; }

const argv = Bun.argv.slice(2);
const args: { brand?: string; level: "AA" | "AAA"; writeBack?: boolean } = { level: "AA" };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--brand") args.brand = argv[++i];
  else if (a === "--level") args.level = argv[++i] as "AA" | "AAA";
  else if (a === "--write-back") args.writeBack = true;
  else if (a === "-h" || a === "--help") {
    console.log("Usage: bun contrast-check.ts --brand <path> [--level AA|AAA] [--write-back]");
    process.exit(0);
  }
}
if (!args.brand) { console.error("--brand required"); process.exit(2); }
if (args.level !== "AA" && args.level !== "AAA") { console.error(`--level must be AA or AAA, got '${args.level}'`); process.exit(2); }
const brandPath = resolve(args.brand);
if (!existsSync(brandPath)) { console.error(`Not found: ${brandPath}`); process.exit(1); }

let brand: any;
try {
  brand = JSON.parse(readFileSync(brandPath, "utf-8"));
} catch (e) {
  console.error(`Invalid JSON in ${brandPath}: ${(e as Error).message}`);
  process.exit(1);
}

const colors: Token[] = brand.tokens?.color ?? [];
function lookup(role: string): Token | undefined {
  return colors.find(t => t.role === role) ?? colors.find(t => t.name === role);
}

// text pairs get the AAA bump (4.5 → 7); non-text pairs stay at 3:1 — WCAG has no AAA tier for non-text contrast.
// advisory pairs report their ratio but never fail the gate: hairline borders are 8–15% fg-mix
// per depth.md R6 and are decorative under WCAG 1.4.11; inputs that rely on border alone must
// use the ring token, which IS gated.
const pairs: Array<{ fg: string; bg: string; min: number; text: boolean; advisory?: boolean; why: string }> = [
  { fg: "fg", bg: "bg", min: 4.5, text: true, why: "body text on background" },
  { fg: "muted-fg", bg: "bg", min: 4.5, text: true, why: "secondary text" },
  { fg: "primary-fg", bg: "primary", min: 4.5, text: true, why: "text on primary button" },
  { fg: "primary-fg", bg: "primary-hover", min: 4.5, text: true, why: "text on primary hover" },
  { fg: "primary-fg", bg: "primary-active", min: 4.5, text: true, why: "text on primary active" },
  { fg: "accent-fg", bg: "accent", min: 4.5, text: true, why: "text on accent" },
  { fg: "destructive-fg", bg: "destructive", min: 4.5, text: true, why: "text on destructive" },
  { fg: "border", bg: "bg", min: 3.0, text: false, advisory: true, why: "border visibility (advisory — hairlines are decorative per depth.md R6)" },
  { fg: "ring", bg: "bg", min: 3.0, text: false, why: "focus ring visibility (3:1 min)" }
];
if (args.level === "AAA") {
  for (const p of pairs) if (p.text) p.min = 7.0;
}

const present = pairs
  .map(p => ({ policy: p, fg: lookup(p.fg), bg: lookup(p.bg) }))
  .filter((x): x is { policy: typeof pairs[number]; fg: Token; bg: Token } => Boolean(x.fg && x.bg));
const skipped = pairs
  .filter(p => !lookup(p.fg) || !lookup(p.bg))
  .map(p => ({ pair: `${p.fg}/${p.bg}`, status: "skipped", reason: `${!lookup(p.fg) ? p.fg : p.bg} not in brand` }));

let computed: ReturnType<typeof buildResults>;
function buildResults() {
  const { results } = colorMath("contrast", {
    pairs: present.map(x => ({ name: `${x.policy.fg}/${x.policy.bg}`, fg: x.fg.value, bg: x.bg.value, min: x.policy.min })),
  });
  return results.map((r, i) => {
    const p = present[i].policy;
    if (r.error) {
      return { pair: r.name, status: "unparseable", value: r.value, why: p.why };
    }
    const ratio = +(r.ratio as number).toFixed(2);
    const status = r.pass ? "pass" : p.advisory ? "advisory" : "fail";
    return {
      pair: r.name,
      fg: present[i].fg.value, bg: present[i].bg.value,
      ratio, required: p.min,
      status,
      wcag: ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA-large" : "fail",
      why: p.why
    };
  });
}
try {
  computed = buildResults();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const results = [...computed, ...skipped];
const failures = computed.filter(r => r.status === "fail" || r.status === "unparseable").length;

if (args.writeBack) {
  brand.derived = brand.derived ?? {};
  brand.derived.contrast = computed
    .filter(r => r.status === "pass" || r.status === "fail")
    .map(r => ({ fg: r.pair.split("/")[0], bg: r.pair.split("/")[1], ratio: r.ratio, wcag: r.wcag }));
  brand.updated_at = new Date().toISOString();
  writeFileSync(brandPath, JSON.stringify(brand, null, 2) + "\n");
}

const out = JSON.stringify({ ok: failures === 0, level: args.level, failures, results }, null, 2);
if (failures > 0) { console.error(out); process.exit(3); }
console.log(out);
process.exit(0);
