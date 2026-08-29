#!/usr/bin/env bun
/**
 * extract-url.ts — Universal source-CSS brand extractor (fast) + opt-in cdp-headless rendered path.
 *
 * Zero npm deps: HTML via Bun's native HTMLRewriter, CSS via vendored css-tree,
 * rendered mode via the cdp-headless skill's Chromium singleton.
 *
 * Usage:
 *   bun extract-url.ts <URL> --output <path.json>
 *       [--rendered]                     opt-in Chromium-rendered extraction
 *       [--max-stylesheets N=5]
 *       [--max-stylesheet-bytes N=204800]
 *       [--timeout-ms N=10000]
 *
 * Exit codes:
 *   0  ok (may include coverage_flags / low confidence — see draft)
 *   1  fetch failure (DNS, timeout, 4xx/5xx)
 *   2  bad args
 *   3  schema-invalid output (shouldn't happen — bug if it does)
 *   4  --rendered requested but the cdp-headless skill's browser could not start
 */

import * as csstree from "../../lib/vendor/css-tree.mjs";
import SAMPLE_JS from "../../lib/page-scripts/computed-sample.js" with { type: "text" };
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hexToOklch, oklchToCss, kmeans, chooseK, parseColorToHex, assignColorRoles } from "../../lib/oklch.js";

const argv = Bun.argv.slice(2);
let url: string | undefined;
const args: { rendered?: boolean; output?: string; maxSheets: number; maxSheetBytes: number; timeoutMs: number } = {
  maxSheets: 5, maxSheetBytes: 204800, timeoutMs: 10000
};
// positional + flags parsed in ONE loop so a flag's value is never mistaken for the URL
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--rendered") args.rendered = true;
  else if (a === "--output") args.output = argv[++i];
  else if (a === "--max-stylesheets") args.maxSheets = parseInt(argv[++i], 10);
  else if (a === "--max-stylesheet-bytes") args.maxSheetBytes = parseInt(argv[++i], 10);
  else if (a === "--timeout-ms") args.timeoutMs = parseInt(argv[++i], 10);
  else if (a === "-h" || a === "--help") {
    console.log("Usage: bun extract-url.ts <URL> --output <path.json> [--rendered] [--max-stylesheets N] [--max-stylesheet-bytes N] [--timeout-ms N]");
    process.exit(0);
  }
  else if (!a.startsWith("--")) url = a;
}
if (!url) { console.error("URL required as positional arg"); process.exit(2); }
if (!args.output) { console.error("--output required"); process.exit(2); }
for (const [k, v] of Object.entries({ maxSheets: args.maxSheets, maxSheetBytes: args.maxSheetBytes, timeoutMs: args.timeoutMs })) {
  if (!Number.isFinite(v) || v <= 0) { console.error(`--${k} must be a positive number`); process.exit(2); }
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 studio/0.2";

async function fetchWithTimeout(target: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(target, { headers: { "User-Agent": UA, "Accept": "text/html,*/*;q=0.8" }, signal: ctrl.signal, redirect: "follow" });
  } finally { clearTimeout(t); }
}

const now = new Date().toISOString();
const host = new URL(url).hostname;
const extractionMode: "fast" | "rendered" = args.rendered ? "rendered" : "fast";

interface ColorCandidate { value: string; weight: number; selector: string; pass: string; }
interface FontCandidate { value: string; weight: number; pass: string; }

const colorCandidates: ColorCandidate[] = [];
const fontCandidates: FontCandidate[] = [];
const sizeCandidates: number[] = [];
const spacingCandidates: number[] = [];
const radiusCandidates: number[] = [];
const shadowCandidates: { value: string; weight: number }[] = [];
const motionDurations: number[] = [];

const customProps: Map<string, { value: string; selector: string }> = new Map();
let totalScriptBytes = 0;
let totalCssBytes = 0;
let themeVariants: Set<string> = new Set();

// --- Color helpers ---------------------------------------------------
// hex/rgb/hsl/oklch/named all normalize through the shared parser — modern
// (Tailwind v4 oklch-emitting) sites extract as well as legacy hex sites.
function normalizeColor(v: string): string | null {
  return parseColorToHex(v);
}

function classifyFontHead(family: string): "serif" | "sans" | "mono" | "display" | "unknown" {
  const f = family.toLowerCase().replace(/['"]/g, "").split(",")[0].trim();
  const mono = ["jetbrains mono", "fira code", "ibm plex mono", "menlo", "monaco", "consolas", "source code pro", "courier", "mono"];
  const serif = ["georgia", "garamond", "merriweather", "playfair", "cambria", "times", "tinos", "lora", "spectral", "freight", "newsreader"];
  const display = ["bebas", "abril", "oswald", "rozha", "fraunces"];
  if (mono.some(m => f.includes(m))) return "mono";
  if (display.some(d => f.includes(d))) return "display";
  if (serif.some(s => f.includes(s))) return "serif";
  if (f.includes("serif") && !f.includes("sans")) return "serif";
  return "sans";
}

// --- CSS walking -----------------------------------------------------
function walkCss(css: string, originSelector: string) {
  let ast;
  try { ast = csstree.parse(css, { positions: false }); } catch { return; }

  csstree.walk(ast, function (node: any) {
    // :root / html / body / [data-theme=...] custom properties
    if (node.type === "Declaration" && node.property?.startsWith("--")) {
      const selector = (this as any).rule?.prelude
        ? csstree.generate((this as any).rule.prelude)
        : "";
      if (/:root|^html$|^body$|\[data-theme/i.test(selector) || originSelector.includes(":root")) {
        const value = csstree.generate(node.value);
        customProps.set(node.property, { value, selector });
        const normalized = normalizeColor(value);
        if (normalized) {
          colorCandidates.push({ value: normalized, weight: 5, selector: `${selector} { ${node.property} }`, pass: "css-custom-property" });
        }
      }
    }

    // theme variants — Rule selectors
    if (node.type === "Rule") {
      const sel = csstree.generate(node.prelude);
      if (/\[data-theme=['"]?(\w+)['"]?\]/i.test(sel)) {
        const m = sel.match(/\[data-theme=['"]?(\w+)['"]?\]/i);
        if (m) themeVariants.add(m[1]);
      }
    }
    // theme variants — @media queries (csstree emits these as Atrule, NOT Rule)
    if (node.type === "Atrule" && node.name === "media" && node.prelude) {
      const prelude = csstree.generate(node.prelude);
      if (/prefers-color-scheme:\s*dark/i.test(prelude)) themeVariants.add("dark");
      if (/prefers-color-scheme:\s*light/i.test(prelude)) themeVariants.add("light");
    }

    // color-bearing declarations
    if (node.type === "Declaration") {
      const prop = node.property;
      const value = csstree.generate(node.value);

      if (["color", "background", "background-color", "border-color", "fill", "stroke", "outline-color"].includes(prop)) {
        for (const m of value.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)/gi)) {
          const c = normalizeColor(m[0]);
          if (c) colorCandidates.push({ value: c, weight: 1, selector: originSelector, pass: "stylesheet-value" });
        }
      }

      if (prop === "font-family") {
        fontCandidates.push({ value: value.replace(/['"]/g, "").trim(), weight: 1, pass: "stylesheet-font-family" });
      }

      if (prop === "font-size") {
        const m = value.match(/([\d.]+)(px|rem)/);
        if (m) {
          const px = m[2] === "rem" ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
          if (px >= 10 && px <= 96) sizeCandidates.push(px);
        }
      }

      if (["margin", "padding", "gap", "margin-top", "margin-bottom", "padding-top", "padding-bottom"].includes(prop)) {
        for (const m of value.matchAll(/([\d.]+)(px|rem)\b/g)) {
          const px = m[2] === "rem" ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
          if (px > 0 && px <= 128) spacingCandidates.push(px);
        }
      }

      if (prop === "border-radius") {
        for (const m of value.matchAll(/([\d.]+)(px|rem)\b/g)) {
          const px = m[2] === "rem" ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
          if (px >= 0 && px <= 9999) radiusCandidates.push(px);
        }
      }

      if (prop === "box-shadow" && value !== "none") {
        shadowCandidates.push({ value, weight: 1 });
      }

      if (prop === "transition" || prop === "transition-duration" || prop === "animation-duration") {
        for (const m of value.matchAll(/([\d.]+)(ms|s)\b/g)) {
          const ms = m[2] === "s" ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
          if (ms > 0 && ms <= 2000) motionDurations.push(ms);
        }
      }
    }
  });
}

// --- Fast path: fetch HTML + linked CSS, parse ----------------------
// HTML parsing via Bun's native HTMLRewriter (streaming; style/script/link/meta
// selectors are all we need) — no HTML-parser dependency.
async function fastExtract() {
  const res = await fetchWithTimeout(url!, args.timeoutMs);
  if (!res.ok) { console.error(`Fetch failed ${res.status}`); process.exit(1); }
  // Use the post-redirect URL as the base for relative stylesheet hrefs.
  const baseUrl = res.url || url!;
  const html = await res.text();

  const styleBlocks: string[] = [];
  const sheetHrefs: string[] = [];
  const inlineAttrs: string[] = [];
  let themeColor: string | null = null;
  let currentStyle: string[] | null = null;
  let currentScript: string[] | null = null;

  const rewriter = new HTMLRewriter()
    .on("meta[name=theme-color]", {
      element(el) { themeColor = el.getAttribute("content"); },
    })
    .on("style", {
      element(el) {
        currentStyle = [];
        el.onEndTag(() => {
          if (currentStyle) styleBlocks.push(currentStyle.join(""));
          currentStyle = null;
        });
      },
      text(t) { if (currentStyle) currentStyle.push(t.text); },
    })
    .on('link[rel=stylesheet]', {
      element(el) {
        const href = el.getAttribute("href");
        if (href) sheetHrefs.push(href);
      },
    })
    .on("script", {
      element(el) {
        totalScriptBytes += (el.getAttribute("src")?.length ?? 0) * 100;
        currentScript = [];
        el.onEndTag(() => {
          if (currentScript) totalScriptBytes += currentScript.join("").length;
          currentScript = null;
        });
      },
      text(t) { if (currentScript) currentScript.push(t.text); },
    })
    .on("[style]", {
      element(el) {
        const st = el.getAttribute("style");
        if (st) inlineAttrs.push(st);
      },
    });
  rewriter.transform(html);

  if (themeColor) {
    const c = normalizeColor(themeColor);
    if (c) colorCandidates.push({ value: c, weight: 10, selector: "meta[theme-color]", pass: "meta-theme-color" });
  }
  for (const css of styleBlocks) {
    totalCssBytes += css.length;
    walkCss(css, ":root /* inline-style */");
  }
  for (const href of sheetHrefs.slice(0, args.maxSheets)) {
    const sheetUrl = new URL(href, baseUrl).toString();
    try {
      const sres = await fetchWithTimeout(sheetUrl, args.timeoutMs);
      if (!sres.ok) continue;
      const css = (await sres.text()).slice(0, args.maxSheetBytes);
      totalCssBytes += css.length;
      walkCss(css, sheetUrl);
    } catch { /* skip broken sheets */ }
  }
  for (const st of inlineAttrs) {
    walkCss(`* { ${st} }`, "inline-attr");
  }
}

// --- Rendered path: drive the cdp-headless skill's Chromium singleton ------
const CDP = `${process.env.HOME}/.claude/skills/cdp-headless/scripts`;
function cdp(script: string, cdpArgs: string[]): { ok: boolean; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["bun", `${CDP}/${script}`, ...cdpArgs], { stdout: "pipe", stderr: "pipe" });
  return { ok: proc.exitCode === 0, stdout: new TextDecoder().decode(proc.stdout), stderr: new TextDecoder().decode(proc.stderr) };
}



async function renderedExtract() {
  const { mkdtempSync, writeFileSync: wf, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join: joinP } = await import("node:path");
  let r = cdp("launch.ts", ["start"]);
  if (!r.ok) { console.error(`cdp-headless browser failed to start: ${r.stderr.trim()}`); process.exit(4); }

  const tmp = mkdtempSync(joinP(tmpdir(), "studio-extract-"));
  const sampleFile = joinP(tmp, "sample.js");
  wf(sampleFile, SAMPLE_JS);
  try {
    for (const colorScheme of ["light", "dark"] as const) {
      cdp("send.ts", ["Emulation.setEmulatedMedia", "--params", JSON.stringify({ features: [{ name: "prefers-color-scheme", value: colorScheme }] })]);
      r = cdp("navigate.ts", [url!, "--wait=load", "--no-system-auth"]);
      if (!r.ok) { console.error(`navigate failed (${colorScheme}): ${r.stderr.trim()}`); process.exit(1); }
      r = cdp("eval.ts", ["--file", sampleFile]);
      if (!r.ok) { console.error(`computed-style sample failed (${colorScheme}): ${r.stderr.trim() || r.stdout.trim()}`); process.exit(1); }
      let sample: any;
      try {
        const parsed = JSON.parse(r.stdout);
        sample = parsed.result ?? parsed.value ?? parsed;
      } catch {
        console.error(`unparseable eval output (${colorScheme}): ${r.stdout.slice(0, 200)}`);
        process.exit(1);
      }

      for (const s of sample.elStyles ?? []) {
        const decls = Object.entries(s).filter(([_, v]) => v && v !== "none" && v !== "rgba(0, 0, 0, 0)").map(([p, v]) => `${p}: ${v}`).join("; ");
        if (decls) walkCss(`* { ${decls} }`, `rendered:${colorScheme}`);
      }
      const rootDecls = Object.entries(sample.rootProps ?? {}).map(([k, v]) => `${k}: ${v}`).join("; ");
      if (rootDecls) walkCss(`:root { ${rootDecls} }`, `rendered:${colorScheme}:root`);

      themeVariants.add(colorScheme);
    }
    cdp("send.ts", ["Emulation.setEmulatedMedia", "--params", JSON.stringify({ features: [] })]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// --- Execute the chosen path -----------------------------------------
try {
  if (args.rendered) {
    await renderedExtract();
  } else {
    await fastExtract();
  }
} catch (e) {
  console.error(`Extraction failed: ${(e as Error).message}`);
  process.exit(1);
}

// --- Synthesize tokens from candidates -------------------------------
// Color: dedupe + cluster
const colorWeights = new Map<string, { weight: number; selector: string; pass: string }>();
for (const c of colorCandidates) {
  const existing = colorWeights.get(c.value);
  if (existing) existing.weight += c.weight;
  else colorWeights.set(c.value, { weight: c.weight, selector: c.selector, pass: c.pass });
}
const colorList = Array.from(colorWeights.entries()).map(([v, info]) => ({ value: v, ...info }));

// Cluster colors in OKLCH if we have ≥5
let colorTokens: any[] = [];
if (colorList.length >= 5) {
  const points = colorList.map(c => hexToOklch(c.value));
  const K = chooseK(points, 3, Math.min(8, colorList.length));
  // weight clusters by candidate WEIGHT (declaration frequency + pass priority),
  // so bg = the dominant surface, not the lightest — dark themes survive
  const { centroids, assignments } = kmeans(points, K, 50);
  const weightedSizes = centroids.map((_, j) =>
    colorList.reduce((s, c, i) => s + (assignments[i] === j ? c.weight : 0), 0));
  const assigned = assignColorRoles(centroids.map((c, i) => ({ c, size: weightedSizes[i] })));
  const totalWeight = weightedSizes.reduce((a, b) => a + b, 0) || 1;
  colorTokens = assigned.map(s => ({
    name: s.role,
    value: oklchToCss(s.c.L, s.c.C, s.c.H),
    category: "color",
    role: s.role,
    provenance: {
      source_type: extractionMode === "rendered" ? "url-rendered" : "url-fast",
      source_url: url, source_selector: `kmeans cluster (weight ${s.size})`,
      extraction_mode: extractionMode, extracted_at: now,
      extractor_pass: "oklch-kmeans"
    },
    confidence: 0.5 + (s.size / totalWeight) * 0.4
  }));
} else {
  // Few colors: keep raw, top by weight, emitted as OKLCH
  colorTokens = colorList.sort((a, b) => b.weight - a.weight).slice(0, 6).map((c, i) => ({
    name: ["bg", "primary", "accent", "fg", "muted", "destructive"][i] ?? `c-${i}`,
    value: (() => { const o = hexToOklch(c.value); return oklchToCss(o.L, o.C, o.H); })(),
    category: "color",
    role: ["bg", "primary", "accent", "fg", "muted", "destructive"][i] ?? "extra",
    provenance: {
      source_type: extractionMode === "rendered" ? "url-rendered" : "url-fast",
      source_url: url, source_selector: c.selector,
      extraction_mode: extractionMode, extracted_at: now,
      extractor_pass: c.pass
    },
    confidence: extractionMode === "rendered" ? 0.85 : 0.70
  }));
}

// Typography: dedupe heads, classify
const fontHeads = new Map<string, { stack: string; head: string; weight: number; cls: string }>();
for (const f of fontCandidates) {
  const head = f.value.split(",")[0].replace(/['"]/g, "").trim();
  const cls = classifyFontHead(head);
  const key = head.toLowerCase();
  const existing = fontHeads.get(key);
  if (existing) existing.weight += f.weight;
  else fontHeads.set(key, { stack: f.value, head, weight: f.weight, cls });
}
const fontList = Array.from(fontHeads.values()).sort((a, b) => b.weight - a.weight);
const display = fontList.find(f => f.cls === "serif" || f.cls === "display") ?? fontList[0];
const body    = fontList.find(f => f.cls === "sans") ?? fontList[1] ?? fontList[0];
const mono    = fontList.find(f => f.cls === "mono");
const typographyTokens: any[] = [];
function ftok(role: string, t: typeof display) {
  if (!t) return;
  typographyTokens.push({
    name: role, value: t.stack, category: "typography", role,
    provenance: { source_type: extractionMode === "rendered" ? "url-rendered" : "url-fast", source_url: url, extraction_mode: extractionMode, extracted_at: now, extractor_pass: "font-family-classify" },
    confidence: extractionMode === "rendered" ? 0.85 : 0.75
  });
}
ftok("display", display);
if (body && body !== display) ftok("body", body);
if (mono) ftok("mono", mono);

// Spacing: cluster into common multiples
function clusterScale(values: number[], baseHints = [4, 8]): { base: number; tokens: number[] } {
  if (values.length === 0) return { base: 4, tokens: [] };
  const counts = new Map<number, number>();
  for (const v of values) counts.set(Math.round(v), (counts.get(Math.round(v)) ?? 0) + 1);
  // Pick base that minimizes off-grid
  let bestBase = 4, bestScore = -Infinity;
  for (const b of baseHints) {
    let onGrid = 0;
    for (const [v, c] of counts) if (v % b === 0) onGrid += c;
    if (onGrid > bestScore) { bestScore = onGrid; bestBase = b; }
  }
  const top = Array.from(counts.entries()).filter(([v]) => v % bestBase === 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v]) => v).sort((a, b) => a - b);
  return { base: bestBase, tokens: top };
}
const spacing = clusterScale(spacingCandidates);
const spacingTokens = spacing.tokens.map((px, i) => ({
  name: `space-${i + 1}`, value: `${px / 16}rem`, category: "spacing", role: `space-${i + 1}`,
  provenance: { source_type: extractionMode === "rendered" ? "url-rendered" : "url-fast", source_url: url, extraction_mode: extractionMode, extracted_at: now, extractor_pass: "spacing-cluster" },
  confidence: extractionMode === "rendered" ? 0.85 : 0.70
}));

// Text scale: unique clustered font sizes → 7-stop roles
const sizeUnique = Array.from(new Set(sizeCandidates.map(v => Math.round(v)))).sort((a, b) => a - b).slice(0, 7);
const sizeRoles = ["xs", "sm", "md", "lg", "xl", "2xl", "display"];
const textScaleTokens = sizeUnique.map((px, i) => ({
  name: `text-${sizeRoles[i] ?? i}`, value: `${px / 16}rem`, category: "text_scale", role: sizeRoles[i] ?? `s${i}`,
  provenance: { source_type: extractionMode === "rendered" ? "url-rendered" : "url-fast", source_url: url, extraction_mode: extractionMode, extracted_at: now, extractor_pass: "font-size-cluster" },
  confidence: extractionMode === "rendered" ? 0.8 : 0.6
}));

// Radius
const radiusUnique = Array.from(new Set(radiusCandidates.map(r => Math.round(r)))).sort((a, b) => a - b).slice(0, 5);
const radiusTokens = radiusUnique.map((r, i) => ({
  name: ["radius-sm", "radius-md", "radius-lg", "radius-xl", "radius-pill"][i] ?? `radius-${i}`,
  value: r >= 9999 ? "9999px" : `${r / 16}rem`,
  category: "depth",
  role: ["radius-sm", "radius-md", "radius-lg", "radius-xl", "radius-pill"][i] ?? `radius-${i}`,
  provenance: { source_type: extractionMode === "rendered" ? "url-rendered" : "url-fast", source_url: url, extraction_mode: extractionMode, extracted_at: now, extractor_pass: "radius-cluster" },
  confidence: extractionMode === "rendered" ? 0.85 : 0.70
}));

// Shadow: top 3 by frequency
const shadowMap = new Map<string, number>();
for (const s of shadowCandidates) shadowMap.set(s.value, (shadowMap.get(s.value) ?? 0) + s.weight);
const topShadows = Array.from(shadowMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
const shadowTokens = topShadows.map(([v], i) => ({
  name: ["shadow-sm", "shadow-md", "shadow-lg"][i] ?? `shadow-${i}`,
  value: v, category: "depth",
  role: ["shadow-sm", "shadow-md", "shadow-lg"][i] ?? `shadow-${i}`,
  provenance: { source_type: extractionMode === "rendered" ? "url-rendered" : "url-fast", source_url: url, extraction_mode: extractionMode, extracted_at: now, extractor_pass: "shadow-frequency" },
  confidence: extractionMode === "rendered" ? 0.80 : 0.65
}));

// Motion: dedupe durations
// map onto the schema's canonical motion roles (dur_micro ≈120 · dur_short ≈220 · dur_long ≈420)
const motionUnique = Array.from(new Set(motionDurations.map(d => Math.round(d)))).sort((a, b) => a - b).slice(0, 3);
const MOTION_ROLES = ["dur_micro", "dur_short", "dur_long"];
const motionTokens = motionUnique.map((ms, i) => ({
  name: MOTION_ROLES[i] ?? `dur-${i}`,
  value: `${ms}ms`, category: "motion",
  role: MOTION_ROLES[i] ?? `dur-${i}`,
  provenance: { source_type: extractionMode === "rendered" ? "url-rendered" : "url-fast", source_url: url, extraction_mode: extractionMode, extracted_at: now, extractor_pass: "motion-duration" },
  confidence: extractionMode === "rendered" ? 0.80 : 0.60
}));

// JS-rendered heuristic (fast path only — rendered path always has good signal).
// Pure-JS sites have 0 CSS bytes; the original `script > css*5` test would evaluate
// to `0 > 0 = false` for those. Treat any-script with zero-css as definitively rendered.
const jsRendered = extractionMode === "fast" && (
  (totalCssBytes === 0 && totalScriptBytes > 0) ||
  (totalCssBytes > 0 && totalScriptBytes > totalCssBytes * 5)
) && colorTokens.length < 10;
const confidenceGlobal = jsRendered ? 0.4 :
  (colorTokens.length === 0 ? 0.1 : Math.min(1, 0.4 + colorTokens.length * 0.05 + (extractionMode === "rendered" ? 0.3 : 0)));

const draft = {
  $schema: "https://github.com/damionrashford/design-system/schema/0.2.0",
  schema_version: "0.2.0",
  source_url: url,
  fetched_at: now,
  updated_at: now,
  tokens: {
    color: colorTokens,
    typography: typographyTokens,
    spacing: spacingTokens,
    text_scale: textScaleTokens,
    motion: motionTokens,
    depth: [...radiusTokens, ...shadowTokens]
  },
  derived: { states: {}, contrast: [] },
  coverage_flags: {
    js_rendered: jsRendered,
    css_in_js_likely: jsRendered,
    theme_variants_found: Array.from(themeVariants),
    // Rendered path actually probes one viewport (1280) per color-scheme; declare
    // only what was probed. To probe multiple, extend renderedExtract() to iterate
    // viewports and merge — kept single for cost (~5-15s per pass).
    responsive_variants_found: extractionMode === "rendered" ? ["1280"] : []
  },
  confidence_global: confidenceGlobal,
  extraction_mode: extractionMode,
  history: [{ at: now, op: "extract", summary: `${extractionMode} extraction from ${host}: ${colorTokens.length}c/${typographyTokens.length}t/${spacingTokens.length}sp/${radiusTokens.length}r/${shadowTokens.length}sh/${motionTokens.length}m tokens` }]
};

writeFileSync(resolve(args.output!), JSON.stringify(draft, null, 2));

const summary = {
  ok: true,
  output: args.output,
  source_url: url,
  extraction_mode: extractionMode,
  confidence_global: confidenceGlobal,
  coverage_flags: draft.coverage_flags,
  token_counts: {
    color: colorTokens.length,
    typography: typographyTokens.length,
    spacing: spacingTokens.length,
    text_scale: textScaleTokens.length,
    motion: motionTokens.length,
    depth: radiusTokens.length + shadowTokens.length
  },
};
console.log(JSON.stringify(summary, null, 2));
