#!/usr/bin/env bun
/**
 * fetch.ts — download README.md + CHANGES.md from microsoft/typescript-go@main
 * into a local cache, so search.ts and direct reads never hit the network.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts [--refresh] [--verbose]
 *
 * Options:
 *   --refresh   Ignore the 24h TTL and re-download both files
 *   --verbose   Print progress to stderr
 */

interface Args {
  refresh?: boolean;
  verbose?: boolean;
}

function printHelp(): void {
  console.error(`Usage: bun fetch.ts [OPTIONS]

Options:
  --refresh   Ignore the 24h TTL and re-download both files
  --verbose   Print progress to stderr
  -h, --help  Show this help`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const a of argv) {
    if (a === "--refresh") args.refresh = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else {
      console.error(`Error: unknown flag: ${a}`);
      printHelp();
      process.exit(2);
    }
  }
  return args;
}

const args = parseArgs(Bun.argv.slice(2));
const log = (msg: string): void => { if (args.verbose) console.error(msg); };

const CACHE_DIR = `${process.env.HOME}/.cache/typescript-7`;
const TTL_MS = 24 * 60 * 60 * 1000;
const SOURCES = [
  { name: "README.md", url: "https://raw.githubusercontent.com/microsoft/typescript-go/main/README.md" },
  { name: "CHANGES.md", url: "https://raw.githubusercontent.com/microsoft/typescript-go/main/CHANGES.md" },
] as const;

const manifestPath = `${CACHE_DIR}/manifest.json`;
const manifestFile = Bun.file(manifestPath);
const manifest: Record<string, number> = (await manifestFile.exists())
  ? await manifestFile.json()
  : {};

const errors: string[] = [];
const fetched: string[] = [];
const skipped: string[] = [];

for (const source of SOURCES) {
  const destPath = `${CACHE_DIR}/${source.name}`;
  const lastFetched = manifest[source.name] ?? 0;
  const stale = Date.now() - lastFetched > TTL_MS;

  if (!args.refresh && !stale && (await Bun.file(destPath).exists())) {
    skipped.push(source.name);
    log(`skip (fresh): ${source.name}`);
    continue;
  }

  log(`fetching: ${source.url}`);
  try {
    const res = await fetch(source.url);
    if (!res.ok) {
      errors.push(`${source.name}: HTTP ${res.status}`);
      continue;
    }
    const body = await res.text();
    await Bun.write(destPath, body);
    manifest[source.name] = Date.now();
    fetched.push(source.name);
  } catch (err) {
    errors.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

console.log(JSON.stringify({ fetched, skipped, errors, cacheDir: CACHE_DIR }, null, 2));
if (errors.length > 0) process.exit(1);
