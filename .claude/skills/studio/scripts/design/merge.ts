#!/usr/bin/env bun
/**
 * merge.ts — Confidence-weighted merge of N drafts into canonical design.json (schema 0.2.0).
 *
 * Usage:
 *   bun merge.ts --drafts a.json,b.json[,c.json] --output design/design.json \
 *                [--strategy confidence-weighted] [--lockfile design/.merge.lock] \
 *                [--resolve key=value]   (repeatable — quote values containing commas)
 *
 * Examples:
 *   --resolve typography.display="Fraunces, Georgia"
 *   --resolve color.accent="oklch(70% 0.15 40)"
 *
 * Per-category rules (see knowledge/rules/schema-conventions.md):
 *   - color: OKLab-space weighted centroid (circular-hue-correct, via color-math.py) → oklch(...)
 *   - spacing / text_scale / numeric motion + depth: unit-normalized weighted average
 *     (rem→px ×16, s→ms ×1000); radius 9999px preserved categorically, never averaged
 *   - categorical (typography family, easings, shadow styles): higher-confidence wins;
 *     if all candidates <0.8 confidence and disagree, emit conflict on stderr
 *   - legacy 0.1.0 drafts accepted: radius/shadow categories fold into depth
 *
 * Exit 0 ok · 1 IO · 2 bad args · 3 conflicts require user resolution
 *   (stderr emits {conflicts: [...]} JSON for the agent to parse).
 */

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { colorMath } from "../../lib/colormath.js";

const SCHEMA_VERSION = "0.2.0";
const SCHEMA_ID = "https://github.com/damionrashford/design-system/schema/0.2.0";
const CATEGORIES = ["color", "typography", "spacing", "text_scale", "motion", "depth"] as const;
type Category = typeof CATEGORIES[number];

const argv = Bun.argv.slice(2);
const args: { drafts?: string; output?: string; strategy: string; lockfile?: string; resolves: Record<string, string> } = {
  strategy: "confidence-weighted", resolves: {}
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--drafts") args.drafts = argv[++i];
  else if (a === "--output") args.output = argv[++i];
  else if (a === "--strategy") args.strategy = argv[++i];
  else if (a === "--lockfile") args.lockfile = argv[++i];
  else if (a === "--resolve") {
    // Single key=value — repeat the flag for multiple. NEVER comma-split here:
    // values may contain commas (e.g. font stacks "Fraunces, Georgia").
    const v = argv[++i];
    const eq = v.indexOf("=");
    if (eq <= 0) { console.error(`Bad --resolve form: '${v}' (expected key=value)`); process.exit(2); }
    args.resolves[v.slice(0, eq)] = v.slice(eq + 1);
  }
  else if (a === "-h" || a === "--help") {
    console.log(`Usage: bun merge.ts --drafts a.json,b.json --output design/design.json [--strategy ...] [--lockfile path] [--resolve key=value]
--resolve is single-pair only; repeat the flag for multiple. Values may contain commas.`);
    process.exit(0);
  }
}
if (!args.drafts || !args.output) { console.error("--drafts and --output required"); process.exit(2); }

let lockHeld = false;
function releaseLock() {
  if (!lockHeld || !args.lockfile) return;
  const lockPath = resolve(args.lockfile);
  if (existsSync(lockPath)) {
    try { unlinkSync(lockPath); } catch { /* ignore */ }
  }
  lockHeld = false;
}
function die(code: number, msg: string): never {
  console.error(msg);
  releaseLock();
  process.exit(code);
}

if (args.lockfile) {
  const lockPath = resolve(args.lockfile);
  if (existsSync(lockPath)) {
    const raw = readFileSync(lockPath, "utf-8").trim();
    const stamp = Number(raw);
    if (!Number.isFinite(stamp)) {
      console.error(`Stale lockfile at ${lockPath} (unparseable). Clearing.`);
      unlinkSync(lockPath);
    } else {
      const age = Date.now() - stamp;
      if (age < 5 * 60 * 1000) {
        console.error(`Lock held (${Math.round(age / 1000)}s old). Wait or remove ${lockPath}.`);
        process.exit(1);
      }
      unlinkSync(lockPath);
    }
  }
  writeFileSync(lockPath, Date.now().toString());
  lockHeld = true;
}

// px-normalized numeric parse; returns null for categorical values (easings, font names, shadows)
function parseNumeric(value: string): { n: number; unit: string } | null {
  const m = String(value).trim().match(/^(-?[\d.]+)\s*(px|rem|em|ms|s|%)?$/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  let unit = (m[2] || "px").toLowerCase();
  if (unit === "rem" || unit === "em") { n *= 16; unit = "px"; }
  if (unit === "s") { n *= 1000; unit = "ms"; }
  return { n, unit };
}

try {
  const draftPaths = args.drafts.split(",").map(p => resolve(p.trim()));
  const drafts = draftPaths.map(p => {
    if (!existsSync(p)) die(1, `Not found: ${p}`);
    try {
      return { path: p, data: JSON.parse(readFileSync(p, "utf-8")) };
    } catch (e) {
      return die(1, `Invalid JSON in ${p}: ${(e as Error).message}`);
    }
  });

  const now = new Date().toISOString();
  const merged: any = {
    $schema: SCHEMA_ID,
    schema_version: SCHEMA_VERSION,
    source_url: drafts[0].data.source_url ?? null,
    fetched_at: drafts[0].data.fetched_at ?? now,
    updated_at: now,
    tokens: Object.fromEntries(CATEGORIES.map(c => [c, []])),
    derived: { states: {}, contrast: [] },
    coverage_flags: { js_rendered: false, css_in_js_likely: false, theme_variants_found: [], responsive_variants_found: [] },
    confidence_global: 0,
    extraction_mode: drafts[0].data.extraction_mode ?? "fast",
    history: []
  };

  // Collect tokens per (category, role); fold legacy radius/shadow into depth.
  const byCatRole = new Map<Category, Map<string, any[]>>(CATEGORIES.map(c => [c, new Map()]));
  for (const d of drafts) {
    const tokens = d.data.tokens ?? {};
    for (const rawCat of Object.keys(tokens)) {
      let cat = rawCat as Category | "radius" | "shadow";
      let prefix = "";
      if (cat === "radius") { cat = "depth"; prefix = "radius-"; }
      else if (cat === "shadow") { cat = "depth"; prefix = "shadow-"; }
      if (!CATEGORIES.includes(cat as Category)) continue;
      for (const tok of tokens[rawCat] ?? []) {
        const role = prefix && !String(tok.role ?? tok.name ?? "").startsWith(prefix)
          ? `${prefix}${tok.role ?? tok.name}`
          : (tok.role ?? tok.name);
        if (!role) continue;
        const m = byCatRole.get(cat as Category)!;
        if (!m.has(role)) m.set(role, []);
        m.get(role)!.push({ ...tok, role, category: cat, _from: d.path });
      }
    }
  }

  const conflicts: any[] = [];
  const push = (cat: Category, tok: any) => merged.tokens[cat].push(tok);

  const mkProv = (pass: string, strategy: string, toks: any[]) => ({
    source_type: "merged",
    extraction_mode: toks[0].provenance?.extraction_mode ?? "fast",
    extracted_at: now,
    extractor_pass: pass,
    sources: toks.map(t => t.provenance),
    merge_strategy: strategy
  });

  // Batch all color centroids into ONE python call.
  const colorGroups: Array<{ name: string; toks: any[] }> = [];
  for (const [cat, roles] of byCatRole) {
    for (const [role, toks] of roles) {
      const resolveKey = `${cat}.${role}`;
      if (args.resolves[resolveKey]) {
        push(cat, {
          name: toks[0].name ?? role, value: args.resolves[resolveKey], category: cat, role,
          provenance: mkProv("merge-resolve", "manual", toks),
          confidence: 1.0
        });
        continue;
      }

      if (cat === "color") {
        colorGroups.push({ name: role, toks });
        continue;
      }

      const numerics = toks.map(t => ({ t, p: parseNumeric(t.value) }));
      const allNumeric = numerics.every(x => x.p !== null);
      const allPill = toks.every(t => /^9999px$/.test(String(t.value).trim()));

      if (allPill) {
        push(cat, {
          name: toks[0].name ?? role, value: "9999px", category: cat, role,
          provenance: mkProv("merge-radius-pill", "highest-wins", toks),
          confidence: Math.max(...toks.map(t => t.confidence ?? 0.5))
        });
      } else if (allNumeric) {
        const vals = numerics.map(x => ({ ...x.p!, w: x.t.confidence ?? 0.5 }));
        const units = new Set(vals.map(v => v.unit));
        if (units.size > 1) {
          conflicts.push({
            category: cat, role,
            candidates: toks.map(t => ({ value: t.value, confidence: t.confidence ?? 0, from: t._from })),
            resolution_required: true,
            resolution_hint: `Mixed units (${[...units].join(", ")}). Pass --resolve ${cat}.${role}="<value>"`
          });
          continue;
        }
        const wSum = vals.reduce((s, v) => s + v.w, 0);
        const avg = vals.reduce((s, v) => s + v.n * v.w, 0) / wSum;
        const rounded = vals[0].unit === "ms" ? Math.round(avg) : Math.round(avg * 16) / 16;
        push(cat, {
          name: toks[0].name ?? role, value: `${rounded}${vals[0].unit}`, category: cat, role,
          provenance: mkProv(`merge-numeric-${cat}`, "confidence-weighted", toks),
          confidence: Math.max(...toks.map(t => t.confidence ?? 0.5))
        });
      } else {
        // Categorical: highest-wins; conflict if all <0.8 and values differ
        const sorted = [...toks].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
        const winner = sorted[0];
        const distinct = new Set(toks.map(t => t.value));
        if (distinct.size > 1 && toks.every(t => (t.confidence ?? 0) < 0.8)) {
          conflicts.push({
            category: cat, role,
            candidates: toks.map(t => ({ value: t.value, confidence: t.confidence ?? 0, from: t._from })),
            resolution_required: true,
            resolution_hint: `Pass --resolve ${cat}.${role}="<value>" to merge.ts`
          });
          continue;
        }
        push(cat, {
          name: winner.name ?? role, value: winner.value, category: cat, role,
          provenance: mkProv(`merge-categorical-${cat}`, "highest-wins", toks),
          confidence: winner.confidence ?? 0.5
        });
      }
    }
  }

  if (colorGroups.length > 0) {
    const { groups } = colorMath("centroid", {
      groups: colorGroups.map(g => ({
        name: g.name,
        points: g.toks.map(t => ({ value: t.value, weight: t.confidence ?? 0.5 })),
      })),
    }) as any;
    for (let i = 0; i < colorGroups.length; i++) {
      const g = colorGroups[i], res = groups[i];
      if (res.error) {
        conflicts.push({
          category: "color", role: g.name,
          candidates: g.toks.map(t => ({ value: t.value, confidence: t.confidence ?? 0, from: t._from })),
          resolution_required: true,
          resolution_hint: `Unparseable color values. Pass --resolve color.${g.name}="oklch(...)"`
        });
        continue;
      }
      push("color", {
        name: g.toks[0].name ?? g.name, value: res.value, category: "color", role: g.name,
        provenance: mkProv("merge-oklab-centroid", "confidence-weighted", g.toks),
        confidence: Math.max(...g.toks.map(t => t.confidence ?? 0.5))
      });
    }
  }

  for (const d of drafts) {
    if (d.data.coverage_flags?.js_rendered) merged.coverage_flags.js_rendered = true;
    if (d.data.coverage_flags?.css_in_js_likely) merged.coverage_flags.css_in_js_likely = true;
    for (const v of d.data.coverage_flags?.theme_variants_found ?? []) {
      if (!merged.coverage_flags.theme_variants_found.includes(v)) merged.coverage_flags.theme_variants_found.push(v);
    }
    for (const v of d.data.coverage_flags?.responsive_variants_found ?? []) {
      if (!merged.coverage_flags.responsive_variants_found.includes(v)) merged.coverage_flags.responsive_variants_found.push(v);
    }
  }

  const allConfs = CATEGORIES.flatMap(c => merged.tokens[c].map((t: any) => t.confidence ?? 0));
  merged.confidence_global = allConfs.length ? allConfs.reduce((a: number, b: number) => a + b, 0) / allConfs.length : 0;
  merged.extraction_mode = drafts.some(d => d.data.extraction_mode === "rendered") ? "rendered" : "fast";

  merged.history = drafts.flatMap(d => d.data.history ?? []);
  merged.history.push({ at: now, op: "merge", summary: `merged ${drafts.length} drafts (${conflicts.length} conflicts)` });

  if (conflicts.length > 0) {
    console.error(JSON.stringify({ conflicts }, null, 2));
    releaseLock();
    process.exit(3);
  }

  const outPath = resolve(args.output);
  const tmp = outPath + ".tmp";
  writeFileSync(tmp, JSON.stringify(merged, null, 2) + "\n");
  renameSync(tmp, outPath);
  releaseLock();

  console.log(JSON.stringify({
    ok: true,
    output: outPath,
    drafts: drafts.map(d => d.path),
    confidence_global: merged.confidence_global,
    extraction_mode: merged.extraction_mode,
    token_counts: Object.fromEntries(CATEGORIES.map(c => [c, merged.tokens[c].length]))
  }, null, 2));
} catch (e) {
  releaseLock();
  console.error(`Merge failed: ${(e as Error).message}`);
  process.exit(1);
}
