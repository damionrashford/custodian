#!/usr/bin/env bun
/**
 * fetch-design-system.ts — pull a real-brand DESIGN profile from getdesign.md,
 * save it into library/design-systems/<slug>.md (already a searchable domain).
 *
 * Uses headless Chromium via Puppeteer because getdesign.md gates the DESIGN
 * markdown behind a JS-rendered tab click. First run downloads Chromium (~200 MB,
 * one-time, cached by Puppeteer under ~/.cache/puppeteer/).
 *
 * Usage:
 *   bun fetch-design-system.ts --slug stripe
 *   bun fetch-design-system.ts --slug linear.app
 *   bun fetch-design-system.ts --list
 *   bun fetch-design-system.ts --slug stripe --dry-run
 *
 * After fetch:
 *   1. bun extract.ts        # (no-op for .md files; they're already plain text — see below)
 *   2. bun embed.ts --book <slug>   # to add semantic search
 *
 * Note: the existing extract.ts only handles PDFs. Brand .md files are saved with
 * a matching <slug>.json sidecar that the search pipeline reads directly.
 *
 * Exit: 0 ok | 1 fetch failed | 2 bad args | 3 slug not in catalog
 */

import { join, resolve } from "node:path";
import GRAB_JS from "../../lib/page-scripts/design-md-grab.js" with { type: "text" };
import { mkdir } from "node:fs/promises";

const LIBRARY = resolve(import.meta.dir, "..", "..", "knowledge", "books");
const DEST_DIR = join(LIBRARY, "design-systems");
const BASE_URL = "https://getdesign.md/{slug}/design-md";

interface BrandEntry { slug: string; name: string; category: string; mood: string; }

const CATALOG: BrandEntry[] = [
  { slug: "claude", name: "Claude", category: "ai-llm", mood: "warm terracotta accent, clean editorial layout" },
  { slug: "cohere", name: "Cohere", category: "ai-llm", mood: "vibrant gradients, data-rich dashboard aesthetic" },
  { slug: "elevenlabs", name: "ElevenLabs", category: "ai-llm", mood: "dark cinematic UI, audio-waveform aesthetics" },
  { slug: "minimax", name: "Minimax", category: "ai-llm", mood: "bold dark interface with neon accents" },
  { slug: "mistral.ai", name: "Mistral AI", category: "ai-llm", mood: "French-engineered minimalism, purple-toned" },
  { slug: "ollama", name: "Ollama", category: "ai-llm", mood: "terminal-first, monochrome simplicity" },
  { slug: "opencode.ai", name: "OpenCode AI", category: "ai-llm", mood: "developer-centric dark theme" },
  { slug: "replicate", name: "Replicate", category: "ai-llm", mood: "clean white canvas, code-forward" },
  { slug: "runwayml", name: "RunwayML", category: "ai-llm", mood: "cinematic dark UI, media-rich layout" },
  { slug: "together.ai", name: "Together AI", category: "ai-llm", mood: "technical, blueprint-style design" },
  { slug: "voltagent", name: "VoltAgent", category: "ai-llm", mood: "void-black canvas, emerald accent, terminal-native" },
  { slug: "x.ai", name: "xAI", category: "ai-llm", mood: "stark monochrome, futuristic minimalism" },
  { slug: "cursor", name: "Cursor", category: "dev-tools", mood: "sleek dark interface, gradient accents" },
  { slug: "expo", name: "Expo", category: "dev-tools", mood: "dark theme, tight letter-spacing, code-centric" },
  { slug: "lovable", name: "Lovable", category: "dev-tools", mood: "playful gradients, friendly dev aesthetic" },
  { slug: "raycast", name: "Raycast", category: "dev-tools", mood: "sleek dark chrome, vibrant gradient accents" },
  { slug: "superhuman", name: "Superhuman", category: "dev-tools", mood: "premium dark UI, keyboard-first, purple glow" },
  { slug: "vercel", name: "Vercel", category: "dev-tools", mood: "black and white precision, Geist font" },
  { slug: "warp", name: "Warp", category: "dev-tools", mood: "dark IDE-like interface, block-based command UI" },
  { slug: "clickhouse", name: "ClickHouse", category: "backend", mood: "yellow-accented, technical documentation style" },
  { slug: "composio", name: "Composio", category: "backend", mood: "modern dark with colorful integration icons" },
  { slug: "hashicorp", name: "HashiCorp", category: "backend", mood: "enterprise-clean, black and white" },
  { slug: "mongodb", name: "MongoDB", category: "backend", mood: "green leaf branding, developer documentation focus" },
  { slug: "posthog", name: "PostHog", category: "backend", mood: "playful hedgehog branding, developer-friendly dark UI" },
  { slug: "sanity", name: "Sanity", category: "backend", mood: "red accent, content-first editorial layout" },
  { slug: "sentry", name: "Sentry", category: "backend", mood: "dark dashboard, data-dense, pink-purple accent" },
  { slug: "supabase", name: "Supabase", category: "backend", mood: "dark emerald theme, code-first" },
  { slug: "cal", name: "Cal.com", category: "saas", mood: "clean neutral UI, developer-oriented simplicity" },
  { slug: "intercom", name: "Intercom", category: "saas", mood: "friendly blue palette, conversational UI patterns" },
  { slug: "linear.app", name: "Linear", category: "saas", mood: "ultra-minimal, precise, purple accent" },
  { slug: "mintlify", name: "Mintlify", category: "saas", mood: "clean, green-accented, reading-optimized" },
  { slug: "notion", name: "Notion", category: "saas", mood: "warm minimalism, serif headings, soft surfaces" },
  { slug: "resend", name: "Resend", category: "saas", mood: "minimal dark theme, monospace accents" },
  { slug: "zapier", name: "Zapier", category: "saas", mood: "warm orange, friendly illustration-driven" },
  { slug: "airtable", name: "Airtable", category: "design-tools", mood: "colorful, friendly, structured data aesthetic" },
  { slug: "clay", name: "Clay", category: "design-tools", mood: "organic shapes, soft gradients, art-directed layout" },
  { slug: "figma", name: "Figma", category: "design-tools", mood: "vibrant multi-color, playful yet professional" },
  { slug: "framer", name: "Framer", category: "design-tools", mood: "bold black and blue, motion-first, design-forward" },
  { slug: "miro", name: "Miro", category: "design-tools", mood: "bright yellow accent, infinite canvas aesthetic" },
  { slug: "webflow", name: "Webflow", category: "design-tools", mood: "blue-accented, polished marketing site aesthetic" },
  { slug: "binance", name: "Binance", category: "fintech", mood: "bold Binance Yellow on monochrome, trading-floor urgency" },
  { slug: "coinbase", name: "Coinbase", category: "fintech", mood: "clean blue identity, trust-focused, institutional feel" },
  { slug: "kraken", name: "Kraken", category: "fintech", mood: "purple-accented dark UI, data-dense dashboards" },
  { slug: "revolut", name: "Revolut", category: "fintech", mood: "sleek dark interface, gradient cards, fintech precision" },
  { slug: "stripe", name: "Stripe", category: "fintech", mood: "signature purple gradients, weight-300 elegance" },
  { slug: "wise", name: "Wise", category: "fintech", mood: "bright green accent, friendly and clear" },
  { slug: "airbnb", name: "Airbnb", category: "ecommerce", mood: "warm coral accent, photography-driven, rounded UI" },
  { slug: "meta", name: "Meta", category: "ecommerce", mood: "photography-first, binary light/dark surfaces, Meta Blue CTAs" },
  { slug: "nike", name: "Nike", category: "ecommerce", mood: "monochrome UI, massive uppercase Futura, full-bleed photography" },
  { slug: "shopify", name: "Shopify", category: "ecommerce", mood: "dark-first cinematic, neon green accent, ultra-light display type" },
  { slug: "apple", name: "Apple", category: "consumer", mood: "premium white space, SF Pro, cinematic imagery" },
  { slug: "ibm", name: "IBM", category: "consumer", mood: "Carbon design system, structured blue palette" },
  { slug: "nvidia", name: "NVIDIA", category: "consumer", mood: "green-black energy, technical power aesthetic" },
  { slug: "pinterest", name: "Pinterest", category: "consumer", mood: "red accent, masonry grid, image-first" },
  { slug: "playstation", name: "PlayStation", category: "consumer", mood: "three-surface channel layout, cyan hover-scale" },
  { slug: "spacex", name: "SpaceX", category: "consumer", mood: "stark black and white, full-bleed imagery, futuristic" },
  { slug: "spotify", name: "Spotify", category: "consumer", mood: "vibrant green on dark, bold type, album-art-driven" },
  { slug: "theverge", name: "The Verge", category: "consumer", mood: "acid-mint and ultraviolet accents, Manuka display type" },
  { slug: "uber", name: "Uber", category: "consumer", mood: "bold black and white, tight type, urban energy" },
  { slug: "wired", name: "WIRED", category: "consumer", mood: "paper-white broadsheet density, custom serif, ink-blue links" },
  { slug: "bmw", name: "BMW", category: "automotive", mood: "dark premium surfaces, precise German engineering" },
  { slug: "bugatti", name: "Bugatti", category: "automotive", mood: "cinema-black canvas, monochrome austerity, monumental display type" },
  { slug: "ferrari", name: "Ferrari", category: "automotive", mood: "chiaroscuro black-white editorial, Ferrari Red with extreme sparseness" },
  { slug: "lamborghini", name: "Lamborghini", category: "automotive", mood: "true black cathedral, gold accent, Neo-Grotesk typography" },
  { slug: "renault", name: "Renault", category: "automotive", mood: "vivid aurora gradients, NouvelR typeface, zero-radius buttons" },
  { slug: "tesla", name: "Tesla", category: "automotive", mood: "radical subtraction, cinematic full-viewport photography, Universal Sans" },
];

const SLUG_INDEX = new Map(CATALOG.map(b => [b.slug, b]));

interface Args { slug?: string; list?: boolean; dryRun?: boolean; force?: boolean; }

function printHelp(): void {
  console.error(`Usage: bun fetch-design-system.ts (--slug NAME | --list) [--dry-run] [--force]

Pulls a real-brand DESIGN profile from getdesign.md via headless Chromium
and saves to library/design-systems/<slug>.md plus a <slug>.json sidecar
(searchable by the existing hybrid pipeline).

Options:
  --slug NAME    Brand slug (e.g. stripe, linear.app, x.ai)
  --list         Print the catalog of ${CATALOG.length} brands grouped by category
  --dry-run      Render and print, don't write to disk
  --force        Re-fetch even if <slug>.md already exists
  -h, --help     Show this help

Exit: 0 ok | 1 fetch failed | 2 bad args | 3 slug not in catalog`);
}

function parseArgs(argv: string[]): Args {
  const a: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--slug") a.slug = argv[++i];
    else if (x === "--list") a.list = true;
    else if (x === "--dry-run") a.dryRun = true;
    else if (x === "--force") a.force = true;
    else if (x === "-h" || x === "--help") { printHelp(); process.exit(0); }
    else { console.error(`Error: unknown flag: ${x}`); process.exit(2); }
  }
  return a;
}

const args = parseArgs(Bun.argv.slice(2));

if (args.list) {
  const byCat = new Map<string, BrandEntry[]>();
  for (const b of CATALOG) {
    if (!byCat.has(b.category)) byCat.set(b.category, []);
    byCat.get(b.category)!.push(b);
  }
  for (const [cat, brands] of byCat) {
    console.log(`\n${cat}`);
    for (const b of brands) console.log(`  ${b.slug.padEnd(16)} ${b.name.padEnd(16)} ${b.mood}`);
  }
  console.log(`\n${CATALOG.length} brands. Fetch with: bun fetch-design-system.ts --slug <slug>`);
  process.exit(0);
}

if (!args.slug) {
  console.error("Error: --slug is required (or use --list)");
  printHelp();
  process.exit(2);
}

const slug = args.slug.toLowerCase().trim();
const entry = SLUG_INDEX.get(slug);
if (!entry) {
  console.error(`Error: '${slug}' not in catalog. Run --list to see options.`);
  process.exit(3);
}

const destPath = join(DEST_DIR, `${slug}.md`);
const sidecarPath = join(DEST_DIR, `${slug}.json`);
if (!args.force && !args.dryRun && await Bun.file(destPath).exists()) {
  console.error(`[skip] ${destPath} exists. Use --force to re-fetch.`);
  process.exit(0);
}

const url = BASE_URL.replace("{slug}", slug);
console.error(`[render] ${url}`);

const CDP = `${process.env.HOME}/.claude/skills/cdp-headless/scripts`;
function cdp(script: string, cdpArgs: string[]): { ok: boolean; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["bun", `${CDP}/${script}`, ...cdpArgs], { stdout: "pipe", stderr: "pipe" });
  return { ok: proc.exitCode === 0, stdout: new TextDecoder().decode(proc.stdout), stderr: new TextDecoder().decode(proc.stderr) };
}

let designText = "";
{
  let r = cdp("launch.ts", ["start"]);
  if (!r.ok) { console.error(`cdp-headless browser failed to start: ${r.stderr.trim()}`); process.exit(4); }
  r = cdp("navigate.ts", [url, "--wait=networkidle", "--no-system-auth"]);
  if (!r.ok) { console.error(`navigate failed: ${r.stderr.trim()}`); process.exit(1); }

  // Click the DESIGN.md tab (if present), give the SPA time to swap content, read the text.
  const { mkdtempSync, writeFileSync: wf, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join: joinP } = await import("node:path");
  const tmpDir = mkdtempSync(joinP(tmpdir(), "studio-fds-"));
  const evalFile = joinP(tmpDir, "grab.js");
  wf(evalFile, GRAB_JS);
  try {
    r = cdp("eval.ts", ["--file", evalFile]);
    if (!r.ok) { console.error(`page read failed: ${r.stderr.trim() || r.stdout.trim()}`); process.exit(1); }
    const parsed = JSON.parse(r.stdout);
    const out = parsed.result ?? parsed.value ?? parsed;
    if (!out.clicked) console.error("[warn] no DESIGN.md tab found — proceeding with whatever rendered");
    const text: string = out.text ?? "";
    const idx = text.indexOf("## Overview");
    if (idx >= 0) {
      designText = text.slice(idx).replace(/\n{3,}/g, "\n\n").trim();
      designText = designText.replace(/\n+Maintained by VoltAgent[\s\S]*$/i, "").trim();
    } else {
      designText = text.trim();
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const looksValid = ["## Overview", "## Colors", "## Typography"].filter(m => designText.includes(m)).length >= 2;
const hexCount = (designText.match(/#[0-9a-fA-F]{6}/g) ?? []).length;

if (args.dryRun) {
  console.log(JSON.stringify({
    slug, name: entry.name, chars: designText.length, looksValid, hexCount,
    preview: designText.slice(0, 600),
  }, null, 2));
  process.exit(looksValid ? 0 : 1);
}

if (!looksValid) {
  console.error(`Error: rendered content does not look like DESIGN.md (only ${hexCount} hex codes, missing markers). Aborting.`);
  process.exit(1);
}

await mkdir(DEST_DIR, { recursive: true });

const header = `# ${entry.name} — design profile\n\nSlug: \`${slug}\`\nCategory: ${entry.category}\nMood: ${entry.mood}\nSource: ${url}\nFetched: ${new Date().toISOString()}\n\n---\n\n`;
await Bun.write(destPath, header + designText);

// Sidecar JSON for the existing search pipeline (treat brand as a 1-page "book")
const sidecar = {
  id: slug,
  title: `${entry.name} design profile`,
  author: "VoltAgent (getdesign.md)",
  domain: "design-systems",
  source: url,
  pages: [{ page: 1, text: designText }],
};
await Bun.write(sidecarPath, JSON.stringify(sidecar, null, 2));

console.log(JSON.stringify({
  slug, name: entry.name, path: destPath, sidecar: sidecarPath,
  chars: designText.length, hexCount, looksValid,
  nextStep: `bun ${resolve(import.meta.dir, "embed.ts")} --book ${slug}`,
}, null, 2));
