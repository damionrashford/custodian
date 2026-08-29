#!/usr/bin/env bun
/**
 * derive-states.ts — Cascade hover / active / disabled / fg / muted-fg / border / ring
 * tokens from base roles (primary, accent, destructive), via the coloraide authority.
 *
 * Math + derivation policy: scripts/design/color-math.py `derive` op. This script
 * owns brand I/O, token upserts with provenance, history, and the atomic write.
 * All emitted values are oklch(...) strings — the OKLCH-only invariant holds.
 *
 * Usage:
 *   bun derive-states.ts --brand design/design.json [--in-place | --output <path>] [--no-cascade]
 *
 * Mode detection: bg lightness > 0.5 → light mode; else dark. Idempotent — derived
 * roles are replaced, never duplicated.
 *
 * Exit 0 ok · 1 IO error · 2 bad args.
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { colorMath } from "../../lib/colormath.js";

interface Token { name: string; value: string; category: string; role: string; provenance: any; confidence: number; }

const argv = Bun.argv.slice(2);
const args: { brand?: string; inPlace?: boolean; output?: string; noCascade?: boolean } = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--brand") args.brand = argv[++i];
  else if (a === "--in-place") args.inPlace = true;
  else if (a === "--output") args.output = argv[++i];
  else if (a === "--no-cascade") args.noCascade = true;
  else if (a === "-h" || a === "--help") {
    console.log("Usage: bun derive-states.ts --brand <path> [--in-place | --output <path>] [--no-cascade]");
    process.exit(0);
  }
}
if (!args.brand) { console.error("--brand required"); process.exit(2); }
if (!args.inPlace && !args.output) args.inPlace = true;

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

let derivation: ReturnType<typeof runDerive>;
function runDerive() {
  return colorMath("derive", {
    colors: colors.map(t => ({ role: t.role ?? t.name, value: t.value })),
    mode: "auto",
  });
}
try {
  derivation = runDerive();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const { mode, derived } = derivation;
const now = new Date().toISOString();
const applied: string[] = [];
const derivedStates: Record<string, any> = brand.derived?.states ?? {};

if (!args.noCascade) {
  for (const d of derived) {
    const baseRole = d.role.replace(/-(hover|active|disabled|fg)$/, "");
    const baseTok = colors.find(c => (c.role ?? c.name) === baseRole);
    const newToken: Token = {
      name: d.role, value: d.value, category: "color", role: d.role,
      provenance: {
        source_type: "derived",
        extraction_mode: baseTok?.provenance?.extraction_mode ?? "fast",
        extracted_at: now,
        extractor_pass: "derive-states-coloraide",
        sources: baseTok ? [baseTok.provenance] : []
      },
      confidence: baseTok?.confidence ?? 0.9
    };
    const idx = colors.findIndex(c => (c.role ?? c.name) === d.role);
    if (idx >= 0) colors[idx] = newToken;
    else colors.push(newToken);
    applied.push(d.role);
  }
}

// derived.states summary record, grouped by base role
for (const d of derived) {
  const m = d.role.match(/^(.*)-(hover|active|disabled|fg)$/);
  if (m) {
    derivedStates[m[1]] = derivedStates[m[1]] ?? {};
    derivedStates[m[1]][m[2]] = d.value;
  } else {
    derivedStates[d.role] = d.value;
  }
}

brand.tokens.color = colors;
brand.derived = brand.derived ?? {};
brand.derived.states = derivedStates;
brand.updated_at = now;
brand.history = brand.history ?? [];
brand.history.push({ at: now, op: "edit", summary: `derive-states cascaded ${applied.length} roles (${applied.join(", ")}) in ${mode} mode` });

const out = JSON.stringify(brand, null, 2) + "\n";
const destPath = args.output ? resolve(args.output) : brandPath;
const tmp = destPath + ".tmp";
writeFileSync(tmp, out);
renameSync(tmp, destPath);

console.log(JSON.stringify({ ok: true, output: destPath, mode, cascaded_roles: applied }, null, 2));
