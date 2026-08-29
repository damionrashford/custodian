#!/usr/bin/env bun
/**
 * search.ts — search the cached React Router docs by markdown section and
 * return full section bodies, filtered by router mode or doc area.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "QUERY" [OPTIONS]
 *   bun ${CLAUDE_SKILL_DIR}/scripts/search.ts --file api/hooks/useLoaderData
 *   bun ${CLAUDE_SKILL_DIR}/scripts/search.ts --list [--section api]
 *
 * Exit codes: 0 ok · 1 cache missing or no matches · 2 invalid args
 */

const CACHE_DIR = `${process.env.HOME}/.cache/react-router-docs`;
const DOCS_DIR = `${CACHE_DIR}/docs`;
const SITE_BASE = "https://reactrouter.com";

const MODES = ["framework", "data", "declarative", "rsc"] as const;
type Mode = (typeof MODES)[number];

interface Args {
  query?: string;
  limit: number;
  maxBody: number;
  mode?: Mode;
  section?: string;
  file?: string;
  list?: boolean;
  verbose?: boolean;
}

interface Doc {
  /** Cache-relative path without extension, e.g. "api/hooks/useLoaderData". */
  slug: string;
  title: string;
  modes: string[];
  section: string;
  text: string;
}

interface Section {
  doc: Doc;
  path: string;
  body: string;
}

function printHelp(): void {
  console.error(`Usage: bun search.ts "QUERY" [OPTIONS]
       bun search.ts --file api/hooks/useLoaderData
       bun search.ts --list [--section api]

Options:
  --limit N            Max hits (default 5)
  --max-body N         Truncate each section body to N chars (default 4000, 0 = no limit)
  --mode MODE          Filter to framework | data | declarative | rsc
  --section AREA       Filter to a top-level docs area (api, start, how-to,
                       explanation, upgrading, tutorials, community)
  --file SLUG          Print one whole doc instead of searching
  --list               List cached docs (respects --section / --mode)
  --verbose            Progress to stderr
  -h, --help           Show this help

Examples:
  bun search.ts "loader revalidation after action"
  bun search.ts "route module type safety" --section how-to
  bun search.ts "useFetcher" --mode framework --limit 3
  bun search.ts --file api/hooks/useFetcher
  bun search.ts --list --section api

Exit codes: 0 ok · 1 cache missing or no matches · 2 invalid args`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 5, maxBody: 4000 };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--limit" || a === "--max-body") {
      const raw = argv[++i];
      const n = Number(raw);
      const min = a === "--limit" ? 1 : 0;
      if (!Number.isInteger(n) || n < min) {
        console.error(`Error: ${a} must be an integer >= ${min}. Received: ${raw ?? "(nothing)"}`);
        process.exit(2);
      }
      if (a === "--limit") args.limit = n; else args.maxBody = n;
    } else if (a === "--mode") {
      const raw = argv[++i];
      if (raw === undefined || !MODES.includes(raw as Mode)) {
        console.error(`Error: --mode must be one of: ${MODES.join(", ")}. Received: ${raw ?? "(nothing)"}`);
        process.exit(2);
      }
      args.mode = raw as Mode;
    } else if (a === "--section") {
      const raw = argv[++i];
      if (raw === undefined) { console.error("Error: --section needs a value"); process.exit(2); }
      args.section = raw;
    } else if (a === "--file") {
      const raw = argv[++i];
      if (raw === undefined) { console.error("Error: --file needs a value"); process.exit(2); }
      args.file = raw.replace(/\.md$/, "");
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

if (!args.list && args.file === undefined && args.query === undefined) {
  console.error("Error: pass a QUERY, or --file SLUG, or --list.");
  printHelp();
  process.exit(2);
}

if (!(await Bun.file(`${CACHE_DIR}/manifest.json`).exists())) {
  console.error("Error: docs cache missing. Run: bun scripts/fetch.ts --verbose");
  process.exit(1);
}

// Docs carry frontmatter `title:` and an inline `[MODES: framework, data]`
// marker; both drive filtering, so parse them once per file.
function parseDoc(slug: string, raw: string): Doc {
  const titleMatch = /^---\n(?:.*\n)*?title:\s*(.+?)\s*\n(?:.*\n)*?---\n/.exec(raw);
  const modesMatch = /\[MODES:\s*([^\]]+)\]/i.exec(raw);
  const fallback = slug.split("/").pop() ?? slug;
  return {
    slug,
    title: titleMatch?.[1]?.replace(/^["']|["']$/g, "") ?? fallback,
    modes: modesMatch?.[1]?.split(",").map((m) => m.trim().toLowerCase()).filter((m) => m.length > 0) ?? [],
    section: slug.includes("/") ? (slug.split("/")[0] ?? "") : "(root)",
    text: raw,
  };
}

const glob = new Bun.Glob("**/*.md");
const docs: Doc[] = [];
for await (const rel of glob.scan({ cwd: DOCS_DIR })) {
  const slug = rel.replace(/\.md$/, "");
  const raw = await Bun.file(`${DOCS_DIR}/${rel}`).text();
  docs.push(parseDoc(slug, raw));
}
log(`loaded ${docs.length} docs`);

if (docs.length === 0) {
  console.error("Error: docs cache is empty. Run: bun scripts/fetch.ts --refresh");
  process.exit(1);
}

const filtered = docs.filter((d) => {
  if (args.section !== undefined && d.section !== args.section) return false;
  // A doc with no MODES marker (tutorials, explanations) applies to every mode.
  if (args.mode !== undefined && d.modes.length > 0 && !d.modes.includes(args.mode)) return false;
  return true;
});

const siteUrl = (slug: string): string => `${SITE_BASE}/${slug.replace(/\/index$/, "")}`;

if (args.list) {
  console.log(JSON.stringify({
    total: filtered.length,
    docs: filtered
      .map((d) => ({ slug: d.slug, title: d.title, section: d.section, modes: d.modes }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  }, null, 2));
  process.exit(0);
}

if (args.file !== undefined) {
  const doc = docs.find((d) => d.slug === args.file);
  if (doc === undefined) {
    console.error(`Error: no cached doc at "${args.file}". Run --list to see available slugs.`);
    process.exit(1);
  }
  console.log(JSON.stringify({
    slug: doc.slug, title: doc.title, modes: doc.modes, url: siteUrl(doc.slug), body: doc.text,
  }, null, 2));
  process.exit(0);
}

function splitSections(doc: Doc): Section[] {
  const lines = doc.text.split("\n");
  const out: Section[] = [];
  const ancestry: string[] = [];
  let heading = doc.title;
  let buffer: string[] = [];
  let inFence = false;

  const flush = (): void => {
    const body = buffer.join("\n").trim();
    if (body.length > 0) {
      const crumbs = ancestry.filter((a) => a !== undefined && a.length > 0);
      // The H1 normally repeats the frontmatter title; don't print it twice.
      if (crumbs[0]?.toLowerCase() === doc.title.toLowerCase()) crumbs.shift();
      out.push({ doc, path: [doc.title, ...crumbs].join(" › "), body });
    }
    buffer = [];
  };

  for (const line of lines) {
    // Headings inside fenced code blocks are content, not structure.
    if (/^\s*```/.test(line)) inFence = !inFence;
    const m = inFence ? null : /^(#{1,6})\s+(.*)$/.exec(line);
    if (m !== null) {
      const hashes = m[1];
      const title = m[2];
      if (hashes !== undefined && title !== undefined) {
        flush();
        const level = hashes.length;
        ancestry.length = Math.max(0, level - 1);
        ancestry[level - 1] = title.trim();
        heading = title.trim();
        continue;
      }
    }
    buffer.push(line);
  }
  flush();
  void heading;
  return out;
}

const sections = filtered.flatMap(splitSections);
log(`${sections.length} sections in scope`);

const query = args.query ?? "";
const terms = query.toLowerCase().split(/[^a-z0-9_.@-]+/).filter((t) => t.length > 1);
if (terms.length === 0) {
  console.error(`Error: query had no searchable terms. Received: "${query}"`);
  process.exit(2);
}

const HEADING_WEIGHT = 5;
const TITLE_WEIGHT = 3;

const scored = sections
  .map((s) => {
    const hPath = s.path.toLowerCase();
    const slug = s.doc.slug.toLowerCase();
    const body = s.body.toLowerCase();
    let score = 0;
    let matched = 0;
    for (const t of terms) {
      const inHeading = hPath.includes(t);
      const inSlug = slug.includes(t);
      const bodyHits = body.split(t).length - 1;
      if (inHeading) score += HEADING_WEIGHT;
      if (inSlug) score += TITLE_WEIGHT;
      score += Math.min(bodyHits, 6);
      if (inHeading || inSlug || bodyHits > 0) matched++;
    }
    const coverage = matched / terms.length;
    // Square the coverage so a section hitting every term beats one that
    // repeats a single common word many times.
    return { s, score: score * coverage * coverage, coverage };
  })
  .filter((r) => r.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, args.limit);

if (scored.length === 0) {
  console.log(JSON.stringify({
    query, total: 0, hits: [],
    hint: "Try --list (optionally with --section) to see available docs, or drop --mode/--section filters.",
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  query,
  filters: { mode: args.mode ?? null, section: args.section ?? null },
  total: scored.length,
  hits: scored.map((r) => {
    const full = r.s.body;
    const truncated = args.maxBody > 0 && full.length > args.maxBody;
    return {
      slug: r.s.doc.slug,
      path: r.s.path,
      modes: r.s.doc.modes,
      score: Number(r.score.toFixed(2)),
      url: siteUrl(r.s.doc.slug),
      truncated,
      body: truncated ? `${full.slice(0, args.maxBody)}\n…[truncated — read the full doc with --file ${r.s.doc.slug}]` : full,
    };
  }),
}, null, 2));
