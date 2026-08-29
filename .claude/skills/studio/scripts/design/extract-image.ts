#!/usr/bin/env bun
/**
 * extract-image.ts — Pixel quantization (via the cdp-headless browser's canvas —
 * Chrome decodes every format it renders: png/jpg/webp/avif/gif) + merge with
 * Claude vision observations. Zero npm dependencies.
 *
 * Usage:
 *   bun extract-image.ts <image-path> --output <path.json> [--vision-json <file-or-->]
 *
 * If --vision-json is "-", read from stdin. Otherwise treat as path.
 *
 * Vision JSON shape (provided by Claude after looking at the image):
 *   {
 *     "dominant_colors": ["#hex", ...],
 *     "accent": "#hex",
 *     "background": "#hex",
 *     "foreground": "#hex",
 *     "typography_categories": ["serif"|"sans"|"display"|"mono", ...],
 *     "spacing_rhythm": "tight"|"standard"|"generous",
 *     "radius_character": "sharp"|"soft"|"pill",
 *     "shadow_presence": "none"|"subtle"|"prominent",
 *     "mood_tags": ["...", ...]
 *   }
 *
 * Exit 0 ok · 1 IO · 2 bad args.
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { hexToOklch, kmeans, chooseK, oklchToCss, parseColorToHex } from "../../lib/oklch.js";
import { makeProvenance } from "../../lib/provenance.js";
import PIXEL_JS from "../../lib/page-scripts/pixel-sample.js" with { type: "text" };

const argv = Bun.argv.slice(2);
let imagePath: string | undefined;
const args: { output?: string; visionJson?: string } = {};
// positional + flags in ONE loop so a flag value is never mistaken for the image path
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--output") args.output = argv[++i];
  else if (a === "--vision-json") args.visionJson = argv[++i];
  else if (a === "-h" || a === "--help") {
    console.log("Usage: bun extract-image.ts <image-path> --output <path.json> [--vision-json <file-or-->]");
    process.exit(0);
  }
  else if (!a.startsWith("--")) imagePath = a;
}
if (!imagePath) { console.error("image path required"); process.exit(2); }
if (!args.output) { console.error("--output required"); process.exit(2); }
const imgPath = resolve(imagePath);
if (!existsSync(imgPath)) { console.error(`Not found: ${imgPath}`); process.exit(1); }

let vision: any = {};
if (args.visionJson) {
  const raw = args.visionJson === "-" ? await Bun.stdin.text() : readFileSync(resolve(args.visionJson), "utf-8");
  try { vision = JSON.parse(raw); } catch { console.error("vision JSON parse failed"); process.exit(2); }
}

// Decode + downsample in the cdp-headless browser: data-URL → <img> → ≤100×100
// canvas → getImageData. Data URLs don't taint the canvas, so this works for
// any format Chrome renders, with no native image dependency.
const CDP = `${process.env.HOME}/.claude/skills/cdp-headless/scripts`;
function cdp(script: string, cdpArgs: string[]): { ok: boolean; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["bun", `${CDP}/${script}`, ...cdpArgs], { stdout: "pipe", stderr: "pipe" });
  return { ok: proc.exitCode === 0, stdout: new TextDecoder().decode(proc.stdout), stderr: new TextDecoder().decode(proc.stderr) };
}
const imgBytes = new Uint8Array(await Bun.file(imgPath).arrayBuffer());
if (imgBytes.length > 12 * 1024 * 1024) { console.error(`Image too large (${(imgBytes.length / 1e6).toFixed(1)}MB > 12MB). Downsize it first.`); process.exit(2); }
const ext = imgPath.toLowerCase().split(".").pop() ?? "png";
const mime = ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif" } as Record<string, string>)[ext] ?? "image/png";
const dataUrl = `data:${mime};base64,${Buffer.from(imgBytes).toString("base64")}`;

{
  const r0 = cdp("launch.ts", ["start"]);
  if (!r0.ok) { console.error(`cdp-headless browser failed to start: ${r0.stderr.trim()}`); process.exit(1); }
}
const { mkdtempSync, rmSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const { join: joinP } = await import("node:path");
const tmpDir = mkdtempSync(joinP(tmpdir(), "studio-img-"));
const evalFile = joinP(tmpDir, "sample.js");
writeFileSync(evalFile, PIXEL_JS.replace("__DATA_URL__", dataUrl));
let raw: any;
try {
  cdp("navigate.ts", ["about:blank", "--wait=load", "--no-system-auth"]);
  const r = cdp("eval.ts", ["--file", evalFile]);
  if (!r.ok) { console.error(`pixel sampling failed: ${r.stderr.trim() || r.stdout.trim()}`); process.exit(1); }
  const parsed = JSON.parse(r.stdout);
  raw = parsed.result ?? parsed.value ?? parsed;
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
if (!raw?.px?.length) { console.error("pixel sampling returned no pixels — is the image decodable?"); process.exit(1); }
const pixels: { L: number; C: number; H: number }[] = raw.px.map((t: [number, number, number]) => {
  const hex = "#" + t.map(c => c.toString(16).padStart(2, "0")).join("");
  return hexToOklch(hex);
});

const K = chooseK(pixels, 3, 6);
const { centroids, sizes } = kmeans(pixels, K, 50);
const sorted = centroids.map((c, i) => ({ c, size: sizes[i] })).sort((a, b) => b.size - a.size);

const baseName = basename(imgPath);
const colorTokens: any[] = [];
const seen = new Set<string>();

function pushColor(role: string, rawValue: string | undefined, source: "vision" | "pixel", confidence: number) {
  if (!rawValue) return;
  const normalized = parseColorToHex(rawValue);
  if (!normalized) return;
  if (seen.has(normalized + role)) return;
  seen.add(normalized + role);
  const o = hexToOklch(normalized);
  colorTokens.push({
    name: role,
    value: oklchToCss(o.L, o.C, o.H),
    category: "color",
    role,
    provenance: makeProvenance({
      source_type: "screenshot",
      source_selector: `${source}:${baseName}`,
      extractor_pass: source === "vision" ? "vision-observation" : "pixel-quantization"
    }),
    confidence
  });
}

pushColor("bg", vision.background, "vision", 0.70);
pushColor("fg", vision.foreground, "vision", 0.70);
pushColor("accent", vision.accent, "vision", 0.75);
if (Array.isArray(vision.dominant_colors)) {
  const roles = ["primary", "muted", "destructive", "success", "extra-1", "extra-2"];
  for (let i = 0; i < vision.dominant_colors.length; i++) {
    pushColor(roles[i] ?? `extra-${i}`, vision.dominant_colors[i], "vision", 0.65);
  }
}
const fillRoles = ["primary", "muted", "extra-pixel-1", "extra-pixel-2"];
let fillIdx = 0;
for (const s of sorted) {
  while (fillIdx < fillRoles.length && colorTokens.find(c => c.role === fillRoles[fillIdx])) fillIdx++;
  if (fillIdx >= fillRoles.length) break;
  pushColor(fillRoles[fillIdx++], oklchToCss(s.c.L, s.c.C, s.c.H), "pixel", 0.55);
}

const typeTokens: any[] = [];
if (Array.isArray(vision.typography_categories)) {
  const cats = vision.typography_categories;
  const mkTypeTok = (role: string, label: string) => ({
    name: role, value: `<observed: ${label} — fill family name manually>`,
    category: "typography", role,
    provenance: makeProvenance({ source_type: "screenshot", source_selector: `vision:${baseName}`, extractor_pass: "vision-typography" }),
    confidence: 0.55
  });
  if (cats.includes("display") || cats.includes("serif")) typeTokens.push(mkTypeTok("display", cats.includes("serif") ? "serif" : "display"));
  if (cats.includes("sans")) typeTokens.push(mkTypeTok("body", "sans"));
  if (cats.includes("mono")) typeTokens.push(mkTypeTok("mono", "mono"));
}

const spacingTokens: any[] = [];
if (vision.spacing_rhythm) {
  const baseUnit = vision.spacing_rhythm === "tight" ? 4 : vision.spacing_rhythm === "generous" ? 12 : 8;
  spacingTokens.push({
    name: "space-base", value: `${baseUnit / 16}rem`, category: "spacing", role: "space-base",
    provenance: makeProvenance({ source_type: "screenshot", source_selector: `vision:${baseName}`, extractor_pass: "vision-spacing-rhythm" }),
    confidence: 0.50
  });
}

const radiusTokens: any[] = [];
if (vision.radius_character) {
  const r = vision.radius_character === "sharp" ? 0 : vision.radius_character === "soft" ? 8 : 9999;
  radiusTokens.push({
    name: "radius-base", value: r === 9999 ? "9999px" : `${r / 16}rem`,
    category: "depth", role: "radius-base",
    provenance: makeProvenance({ source_type: "screenshot", source_selector: `vision:${baseName}`, extractor_pass: "vision-radius-character" }),
    confidence: 0.55
  });
}

const shadowTokens: any[] = [];
if (vision.shadow_presence && vision.shadow_presence !== "none") {
  shadowTokens.push({
    name: "shadow-md",
    value: vision.shadow_presence === "subtle" ? "0 1px 2px 0 rgba(0,0,0,0.05)" : "0 8px 24px 0 rgba(0,0,0,0.12)",
    category: "depth", role: "shadow-md",
    provenance: makeProvenance({ source_type: "screenshot", source_selector: `vision:${baseName}`, extractor_pass: "vision-shadow-presence" }),
    confidence: 0.55
  });
}

// Vision can't observe motion timing in a static image — emit empty array
// (not omit it) so schema validation passes.
const motionTokens: any[] = [];

const now = new Date().toISOString();
const draft = {
  $schema: "https://github.com/damionrashford/design-system/schema/0.2.0",
  schema_version: "0.2.0",
  source_url: null,
  fetched_at: now,
  updated_at: now,
  tokens: {
    color: colorTokens,
    typography: typeTokens,
    spacing: spacingTokens,
    text_scale: [],
    motion: motionTokens,
    depth: [...radiusTokens, ...shadowTokens]
  },
  derived: { states: {}, contrast: [] },
  coverage_flags: {
    js_rendered: false, css_in_js_likely: false,
    theme_variants_found: [], responsive_variants_found: []
  },
  confidence_global: 0.6,
  extraction_mode: "fast",
  history: [{ at: now, op: "extract", summary: `screenshot extraction from ${baseName}: vision + pixel quantization` }],
  mood_tags: vision.mood_tags ?? []
};

writeFileSync(resolve(args.output!), JSON.stringify(draft, null, 2));
console.log(JSON.stringify({
  ok: true,
  output: args.output,
  image: baseName,
  token_counts: {
    color: colorTokens.length,
    typography: typeTokens.length,
    spacing: spacingTokens.length,
    text_scale: 0,
    motion: motionTokens.length,
    depth: radiusTokens.length + shadowTokens.length
  },
  mood_tags: draft.mood_tags
}, null, 2));
