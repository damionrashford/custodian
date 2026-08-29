#!/usr/bin/env bun
/**
 * search.ts — search the cached typescript-go docs by markdown section and
 * return full section bodies (not just headings), so the caller can answer
 * without a second read.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "QUERY" [OPTIONS]
 *   bun ${CLAUDE_SKILL_DIR}/scripts/search.ts --list
 *
 * Options:
 *   --limit N              Max hits to return (default 5)
 *   --source changes|readme  Restrict to one file
 *   --list                 Print every section heading; no query needed
 *   --verbose              Print progress to stderr
 *
 * Exit codes: 0 ok · 1 cache missing or no matches · 2 invalid args
 */

interface Args {
  query?: string;
  limit: number;
  source?: "changes" | "readme";
  list?: boolean;
  verbose?: boolean;
}

interface Section {
  source: string;
  url: string;
  heading: string;
  path: string;
  level: number;
  body: string;
}

const CACHE_DIR = `${process.env.HOME}/.cache/typescript-7`;

const FILES = [
  {
    key: "readme",
    name: "README.md",
    url: "https://github.com/microsoft/typescript-go/blob/main/README.md",
  },
  {
    key: "changes",
    name: "CHANGES.md",
    url: "https://github.com/microsoft/typescript-go/blob/main/CHANGES.md",
  },
] as const;

function printHelp(): void {
  console.error(`Usage: bun search.ts "QUERY" [OPTIONS]
       bun search.ts --list

Options:
  --limit N                Max hits to return (default 5)
  --source changes|readme  Restrict to one file
  --list                   Print every section heading; no query needed
  --verbose                Print progress to stderr
  -h, --help               Show this help

Examples:
  bun search.ts "constructor function no longer supported"
  bun search.ts "expando void 0" --source changes
  bun search.ts "language service status" --source readme --limit 3
  bun search.ts --list

Exit codes: 0 ok · 1 cache missing or no matches · 2 invalid args`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 5 };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--limit") {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        console.error(`Error: --limit must be a positive integer. Received: ${raw ?? "(nothing)"}`);
        process.exit(2);
      }
      args.limit = n;
    } else if (a === "--source") {
      const raw = argv[++i];
      if (raw !== "changes" && raw !== "readme") {
        console.error(`Error: --source must be one of: changes, readme. Received: ${raw ?? "(nothing)"}`);
        process.exit(2);
      }
      args.source = raw;
    } else if (a === "--list") args.list = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else if (a.startsWith("--")) {
      console.error(`Error: unknown flag: ${a}`);
      printHelp();
      process.exit(2);
    } else positional.push(a);
  }
  if (positional.length > 0) args.query = positional.join(" ");
  return args;
}

const args = parseArgs(Bun.argv.slice(2));
const log = (msg: string): void => { if (args.verbose) console.error(msg); };

if (!args.list && !args.query) {
  console.error("Error: a QUERY is required (or pass --list to see all sections).");
  printHelp();
  process.exit(2);
}

// Split a markdown file into sections at heading boundaries, tracking the
// heading ancestry so a hit on "### Expandos" reports its parent chapter too.
function splitSections(markdown: string, source: string, url: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  const ancestry: string[] = [];
  let current: Section | null = null;
  const buffer: string[] = [];

  const flush = (): void => {
    if (current === null) return;
    current.body = buffer.join("\n").trim();
    if (current.body.length > 0 || current.heading.length > 0) sections.push(current);
    buffer.length = 0;
  };

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match !== null) {
      const hashes = match[1];
      const title = match[2];
      if (hashes === undefined || title === undefined) continue;
      flush();
      const level = hashes.length;
      ancestry.length = Math.max(0, level - 1);
      ancestry[level - 1] = title.trim();
      current = {
        source,
        url,
        heading: title.trim(),
        path: ancestry.filter((s) => s !== undefined && s.length > 0).join(" › "),
        level,
        body: "",
      };
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

const sections: Section[] = [];
const missing: string[] = [];

for (const file of FILES) {
  if (args.source !== undefined && args.source !== file.key) continue;
  const path = `${CACHE_DIR}/${file.name}`;
  const handle = Bun.file(path);
  if (!(await handle.exists())) {
    missing.push(file.name);
    continue;
  }
  const text = await handle.text();
  sections.push(...splitSections(text, file.name, file.url));
  log(`loaded ${file.name}`);
}

if (missing.length > 0) {
  console.error(
    `Error: cache missing (${missing.join(", ")}). Run: bun scripts/fetch.ts --refresh`,
  );
  process.exit(1);
}

if (args.list) {
  console.log(
    JSON.stringify(
      {
        total: sections.length,
        sections: sections.map((s) => ({ source: s.source, path: s.path, level: s.level })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const query = args.query ?? "";
const terms = query
  .toLowerCase()
  .split(/[^a-z0-9@.]+/)
  .filter((t) => t.length > 1);

if (terms.length === 0) {
  console.error(`Error: query had no searchable terms. Received: "${query}"`);
  process.exit(2);
}

// Heading matches weigh more than body matches: the corpus is small and the
// headings are the migration index ("Expandos", "CommonJS syntax", ...).
const HEADING_WEIGHT = 4;

const scored = sections
  .map((section) => {
    const haystackHeading = section.path.toLowerCase();
    const haystackBody = section.body.toLowerCase();
    let score = 0;
    let matched = 0;
    for (const term of terms) {
      const inHeading = haystackHeading.includes(term);
      const bodyHits = haystackBody.split(term).length - 1;
      if (inHeading) score += HEADING_WEIGHT;
      score += Math.min(bodyHits, 5);
      if (inHeading || bodyHits > 0) matched++;
    }
    // Reward sections covering more distinct query terms, not one term repeated.
    const coverage = matched / terms.length;
    return { section, score: score * coverage, coverage };
  })
  .filter((s) => s.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, args.limit);

if (scored.length === 0) {
  console.log(JSON.stringify({ query, total: 0, hits: [], hint: "Try --list to see all section headings." }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      query,
      total: scored.length,
      hits: scored.map((s) => ({
        source: s.section.source,
        path: s.section.path,
        score: Number(s.score.toFixed(2)),
        coverage: Number(s.coverage.toFixed(2)),
        url: s.section.url,
        body: s.section.body,
      })),
    },
    null,
    2,
  ),
);
