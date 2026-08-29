#!/usr/bin/env bun
/**
 * fetch.ts — Download Bun's official docs into a local cache.
 *
 * Strategy:
 *   1. Read the canonical Mintlify-served indices:
 *        - https://bun.com/docs/llms.txt
 *        - https://bun.com/reference/llms.txt
 *      Each lists every page in its subtree.
 *   2. For each listed page URL, fetch the `.md` sibling (Mintlify serves raw
 *      markdown alongside HTML, e.g. `/docs/runtime/file-io.md`).
 *   3. Also scrape recent blog posts from https://bun.com/blog (no llms.txt).
 *   4. Write each markdown body to ~/.cache/bun-docs/raw/<safe-path>.md
 *      and a manifest.json with URL → file mapping + fetched-at timestamps.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts            # incremental fetch
 *   bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts --refresh  # force re-fetch
 *   bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts --verbose
 *   bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts --dry-run
 *
 * Output (stdout, JSON): { pagesFetched, pagesSkipped, errors, manifestPath }.
 */

import { mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const CACHE_ROOT = join(homedir(), ".cache", "bun-docs");
const RAW_DIR = join(CACHE_ROOT, "raw");
const MANIFEST_PATH = join(CACHE_ROOT, "manifest.json");
const USER_AGENT = "bun-docs-skill/1.0 (+https://github.com/anthropics/agentskills)";
const REQUEST_CONCURRENCY = 8;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // re-fetch a page after 24h
const BUN_BASE = "https://bun.com";

interface Source {
  name: string;
  llmsTxt?: string;
  /** HTML index page + the path prefix of in-subtree links to extract. */
  htmlIndex?: { url: string; pathPrefix: string };
}

const SOURCES: Source[] = [
  { name: "docs", llmsTxt: `${BUN_BASE}/docs/llms.txt` },
  {
    name: "reference",
    // No /reference/llms.txt is published; scrape the index HTML instead.
    htmlIndex: { url: `${BUN_BASE}/reference`, pathPrefix: "/reference/" },
  },
  {
    name: "blog",
    htmlIndex: { url: `${BUN_BASE}/blog`, pathPrefix: "/blog/" },
  },
];

interface ManifestEntry {
  url: string;
  source: string;
  file: string; // relative to CACHE_ROOT
  bytes: number;
  fetchedAt: string;
  contentType: string;
}
interface Manifest {
  version: 1;
  fetchedAt: string;
  entries: Record<string, ManifestEntry>;
}

interface Args {
  refresh?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

function printHelp(): void {
  console.error(`Usage: bun fetch.ts [OPTIONS]

Options:
  --refresh    Force re-fetch every page (ignore cache TTL)
  --verbose    Print every URL to stderr as it's fetched
  --dry-run    Show what would be fetched without writing
  -h, --help   Show this help`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--refresh") args.refresh = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else if (a && a.startsWith("--")) {
      console.error(`Error: unknown flag: ${a}`);
      printHelp();
      process.exit(2);
    }
  }
  return args;
}

// Bun-native: Bun.argv is the documented idiom; process.argv works too but
// Bun.argv matches what bun.com/docs/guides/process/argv recommends.
const args = parseArgs(Bun.argv.slice(2));
const log = (msg: string): void => {
  if (args.verbose) console.error(msg);
};

// ----- URL discovery ------------------------------------------------------

/** Read a Mintlify llms.txt and extract page URLs. Format is:
 *    - [Page title](https://bun.com/docs/path): one-line description.
 *  Lines without that pattern are ignored. */
async function discoverFromLlmsTxt(url: string): Promise<string[]> {
  log(`[discover] ${url}`);
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    console.error(`[discover] ${url} -> ${res.status}; skipping`);
    return [];
  }
  const text = await res.text();
  const urls = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/\((https?:\/\/[^\s)]+)\)/);
    if (m && m[1]) {
      // Strip trailing ".md" so we have the canonical URL; we'll fetch the .md
      // version explicitly in toMarkdownUrl below.
      let u = m[1];
      if (u.endsWith(".md")) u = u.slice(0, -3);
      urls.add(u);
    }
  }
  return Array.from(urls);
}

/** Scrape an HTML index page for relative links matching a path prefix.
 *  Used for subtrees without an llms.txt (currently `reference` and `blog`). */
async function discoverFromHtml(
  indexUrl: string,
  pathPrefix: string,
): Promise<string[]> {
  log(`[discover] ${indexUrl}`);
  const res = await fetch(indexUrl, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    console.error(`[discover] ${indexUrl} -> ${res.status}; skipping`);
    return [];
  }
  const html = await res.text();
  // Match href="<prefix><slug>" or href="<prefix><slug>/<more>".
  // Escape the prefix for regex; slugs are url-safe chars.
  const escaped = pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`href=["'](${escaped}[A-Za-z0-9/_.-]+)["']`, "gi");
  const urls = new Set<string>();
  for (const m of html.matchAll(pattern)) {
    if (m[1]) {
      // Drop fragments and querystrings
      const clean = m[1].split("#")[0]!.split("?")[0]!;
      // Skip the index itself (e.g. /reference linking to /reference)
      if (clean === pathPrefix.replace(/\/$/, "")) continue;
      urls.add(`${BUN_BASE}${clean}`);
    }
  }
  return Array.from(urls);
}

/** Mintlify serves raw markdown at <url>.md. */
function toMarkdownUrl(url: string): string {
  if (url.endsWith(".md")) return url;
  return `${url}.md`;
}

/** Map a remote URL to a safe local cache path. */
function urlToCachePath(url: string): string {
  const u = new URL(url);
  const safePath = u.pathname.replace(/^\/+/, "").replace(/[^A-Za-z0-9._/-]/g, "_");
  const final = safePath.endsWith(".md") ? safePath : `${safePath || "index"}.md`;
  return join(RAW_DIR, final);
}

// ----- Fetch + cache ------------------------------------------------------

interface FetchOutcome {
  url: string;
  source: string;
  status: "fetched" | "skipped-fresh" | "error";
  bytes?: number;
  file?: string;
  error?: string;
}

async function fetchOne(
  url: string,
  source: string,
  manifest: Manifest,
): Promise<FetchOutcome> {
  const mdUrl = toMarkdownUrl(url);
  const cachePath = urlToCachePath(url);
  const rel = cachePath.slice(CACHE_ROOT.length + 1);
  const existing = manifest.entries[url];

  if (!args.refresh && existing) {
    const age = Date.now() - new Date(existing.fetchedAt).getTime();
    if (age < MAX_AGE_MS) {
      log(`[skip-fresh] ${url}`);
      return { url, source, status: "skipped-fresh", file: rel };
    }
  }

  log(`[fetch] ${mdUrl}`);
  if (args.dryRun) {
    return { url, source, status: "fetched", file: rel, bytes: 0 };
  }

  try {
    const res = await fetch(mdUrl, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) {
      return { url, source, status: "error", error: `${res.status} ${res.statusText}` };
    }
    const body = await res.text();
    await mkdir(dirname(cachePath), { recursive: true });
    const bytes = await Bun.write(cachePath, body);
    manifest.entries[url] = {
      url,
      source,
      file: rel,
      bytes,
      fetchedAt: new Date().toISOString(),
      contentType: res.headers.get("content-type") ?? "text/markdown",
    };
    return { url, source, status: "fetched", bytes, file: rel };
  } catch (err) {
    return { url, source, status: "error", error: (err as Error).message };
  }
}

// ----- Driver -------------------------------------------------------------

async function loadManifest(): Promise<Manifest> {
  const f = Bun.file(MANIFEST_PATH);
  if (await f.exists()) {
    try {
      return (await f.json()) as Manifest;
    } catch {
      // corrupt manifest — start fresh
    }
  }
  return { version: 1, fetchedAt: new Date(0).toISOString(), entries: {} };
}

async function saveManifest(manifest: Manifest): Promise<void> {
  manifest.fetchedAt = new Date().toISOString();
  await mkdir(CACHE_ROOT, { recursive: true });
  await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

/** Limit concurrent fetches. */
async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  const manifest = await loadManifest();

  // 1. Discover URLs from every source.
  const toFetch: { url: string; source: string }[] = [];
  for (const src of SOURCES) {
    let urls: string[] = [];
    if (src.llmsTxt) {
      urls = await discoverFromLlmsTxt(src.llmsTxt);
    } else if (src.htmlIndex) {
      urls = await discoverFromHtml(src.htmlIndex.url, src.htmlIndex.pathPrefix);
    }
    for (const u of urls) toFetch.push({ url: u, source: src.name });
  }
  log(`[discover] total ${toFetch.length} URLs across ${SOURCES.length} sources`);

  // 2. Fetch with bounded concurrency.
  const outcomes = await withConcurrency(toFetch, REQUEST_CONCURRENCY, ({ url, source }) =>
    fetchOne(url, source, manifest),
  );

  if (!args.dryRun) await saveManifest(manifest);

  const fetched = outcomes.filter((o) => o.status === "fetched").length;
  const skipped = outcomes.filter((o) => o.status === "skipped-fresh").length;
  const errors = outcomes.filter((o) => o.status === "error");

  // 3. Sweep cache files that no longer correspond to any discovered URL.
  const liveFiles = new Set(Object.values(manifest.entries).map((e) => e.file));
  let pruned = 0;
  if (!args.dryRun) {
    for (const f of await walkMd(RAW_DIR)) {
      const rel = f.slice(CACHE_ROOT.length + 1);
      if (!liveFiles.has(rel)) {
        await Bun.file(f).delete();
        pruned++;
      }
    }
  }

  console.log(
    JSON.stringify({
      pagesFetched: fetched,
      pagesSkipped: skipped,
      pagesPruned: pruned,
      errors: errors.map((e) => ({ url: e.url, error: e.error })),
      manifestPath: MANIFEST_PATH,
    }, null, 2),
  );
}

async function walkMd(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir, { recursive: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.endsWith(".md")) out.push(join(dir, e));
  }
  return out;
}

await main();
