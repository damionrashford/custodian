#!/usr/bin/env bun
/**
 * fetch.ts — cache the complete React Router documentation locally.
 *
 * Two corpora:
 *   1. Every markdown file under docs/ in remix-run/react-router (the exact
 *      source of every page on reactrouter.com).
 *   2. The TypeDoc symbol index from api.reactrouter.com (every exported
 *      symbol -> reference URL), decoded from its compressed search blob.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts [--refresh] [--ref main] [--verbose]
 *
 * Exit codes: 0 ok · 1 one or more downloads failed · 2 invalid args
 */

import { inflateSync } from "node:zlib";

interface Args {
  refresh?: boolean;
  ref: string;
  concurrency: number;
  verbose?: boolean;
}

const CACHE_DIR = `${process.env.HOME}/.cache/react-router-docs`;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TYPEDOC_BASE = "https://api.reactrouter.com/v8";

function printHelp(): void {
  console.error(`Usage: bun fetch.ts [OPTIONS]

Caches all React Router docs markdown + the TypeDoc symbol index to
~/.cache/react-router-docs.

Options:
  --refresh          Ignore the 7-day TTL and re-download everything
  --ref REF          Git ref to pull docs from (default: main)
  --concurrency N    Parallel downloads (default: 12)
  --verbose          Print progress to stderr
  -h, --help         Show this help

Exit codes: 0 ok · 1 download failures · 2 invalid args`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { ref: "main", concurrency: 12 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--refresh") args.refresh = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--ref") {
      const v = argv[++i];
      if (v === undefined) { console.error("Error: --ref needs a value"); process.exit(2); }
      args.ref = v;
    } else if (a === "--concurrency") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v < 1 || v > 32) {
        console.error("Error: --concurrency must be an integer 1-32");
        process.exit(2);
      }
      args.concurrency = v;
    } else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else { console.error(`Error: unknown flag: ${a}`); printHelp(); process.exit(2); }
  }
  return args;
}

const args = parseArgs(Bun.argv.slice(2));
const log = (msg: string): void => { if (args.verbose) console.error(msg); };

const manifestPath = `${CACHE_DIR}/manifest.json`;
const manifestFile = Bun.file(manifestPath);
const manifest: { fetchedAt?: number; ref?: string; docCount?: number; symbolCount?: number } =
  (await manifestFile.exists()) ? await manifestFile.json() : {};

const fresh =
  manifest.fetchedAt !== undefined &&
  Date.now() - manifest.fetchedAt < TTL_MS &&
  manifest.ref === args.ref;

if (!args.refresh && fresh) {
  console.log(JSON.stringify({ status: "cached", ...manifest, cacheDir: CACHE_DIR }, null, 2));
  process.exit(0);
}

const errors: string[] = [];

// --- 1. docs/ markdown -------------------------------------------------------

log(`listing docs/ at ref ${args.ref}…`);
const treeUrl = `https://api.github.com/repos/remix-run/react-router/git/trees/${args.ref}?recursive=1`;
const treeRes = await fetch(treeUrl, {
  headers: { Accept: "application/vnd.github+json", "User-Agent": "react-router-skill" },
});
if (!treeRes.ok) {
  console.error(`Error: could not list repo tree (HTTP ${treeRes.status}) from ${treeUrl}`);
  process.exit(1);
}
const tree = (await treeRes.json()) as { tree?: { path: string; type: string }[] };
const docPaths = (tree.tree ?? [])
  .filter((t) => t.type === "blob" && t.path.startsWith("docs/") && t.path.endsWith(".md"))
  .map((t) => t.path);

if (docPaths.length === 0) {
  console.error("Error: repo tree returned no docs/*.md files — the docs may have moved.");
  process.exit(1);
}
log(`found ${docPaths.length} markdown files`);

let done = 0;
async function download(path: string): Promise<void> {
  const url = `https://raw.githubusercontent.com/remix-run/react-router/${args.ref}/${path}`;
  try {
    const res = await fetch(url);
    if (!res.ok) { errors.push(`${path}: HTTP ${res.status}`); return; }
    // Mirror the repo layout under the cache, minus the leading "docs/".
    await Bun.write(`${CACHE_DIR}/docs/${path.slice("docs/".length)}`, await res.text());
    done++;
    if (args.verbose && done % 25 === 0) log(`  ${done}/${docPaths.length}`);
  } catch (err) {
    errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

for (let i = 0; i < docPaths.length; i += args.concurrency) {
  await Promise.all(docPaths.slice(i, i + args.concurrency).map(download));
}
log(`downloaded ${done} files`);

// --- 2. TypeDoc symbol index -------------------------------------------------

interface SymbolRow {
  kind: number;
  name: string;
  url: string;
  parent?: string;
}

let symbolCount = 0;
log("fetching TypeDoc symbol index…");
try {
  const res = await fetch(`${TYPEDOC_BASE}/assets/search.js`);
  if (!res.ok) {
    errors.push(`typedoc search.js: HTTP ${res.status}`);
  } else {
    const raw = await res.text();
    // Shape: window.searchData = "<base64 of zlib-compressed JSON>";
    const first = raw.indexOf('"');
    const last = raw.lastIndexOf('"');
    if (first === -1 || last <= first) {
      errors.push("typedoc search.js: unexpected format (no quoted payload)");
    } else {
      const b64 = raw.slice(first + 1, last);
      const json = JSON.parse(
        inflateSync(Buffer.from(b64, "base64")).toString("utf8"),
      ) as { rows?: SymbolRow[] };
      const rows = json.rows ?? [];
      const symbols = rows.map((r) => ({
        name: r.name,
        kind: r.kind,
        package: r.parent ?? "",
        url: `${TYPEDOC_BASE}/${r.url}`,
      }));
      symbolCount = symbols.length;
      await Bun.write(`${CACHE_DIR}/symbols.json`, JSON.stringify(symbols));
      log(`indexed ${symbolCount} symbols`);
    }
  }
} catch (err) {
  errors.push(`typedoc search.js: ${err instanceof Error ? err.message : String(err)}`);
}

// --- manifest ----------------------------------------------------------------

const summary = {
  status: "fetched",
  ref: args.ref,
  fetchedAt: Date.now(),
  docCount: done,
  symbolCount,
  errors,
  cacheDir: CACHE_DIR,
};
await Bun.write(manifestPath, JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
if (errors.length > 0) process.exit(1);
