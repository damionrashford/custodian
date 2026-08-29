#!/usr/bin/env bun
/**
 * fetch-tech-docs.ts — pull live docs for React Router and Tailwind CSS v4
 * from their official GitHub repos, save as searchable "books" in library/tech-docs/.
 *
 * Sources (raw markdown, always current with main branch):
 *   - react-router : remix-run/react-router        → docs/**\/*.md   (~206 pages)
 *   - tailwind     : tailwindlabs/tailwindcss.com  → src/docs/*.mdx  (~197 pages)
 *
 * After fetch:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/library/embed.ts --book react-router
 *   bun ${CLAUDE_SKILL_DIR}/scripts/library/embed.ts --book tailwind
 *
 * Then both are addressable via search.ts:
 *   bun search.ts --book react-router "createBrowserRouter loader"
 *   bun search.ts --book tailwind "border-radius"
 *
 * Usage:
 *   bun fetch-tech-docs.ts                  # both sources, skip cached
 *   bun fetch-tech-docs.ts --source react-router
 *   bun fetch-tech-docs.ts --source tailwind
 *   bun fetch-tech-docs.ts --force          # re-fetch everything
 *   bun fetch-tech-docs.ts --concurrency 16
 *
 * Exit: 0 ok | 1 fetch failed | 2 bad args | 3 gh CLI missing/auth
 */

import { join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const LIBRARY = resolve(import.meta.dir, "..", "..", "knowledge", "books");
const DEST_DIR = join(LIBRARY, "tech-docs");

interface DocSource {
  id: string;
  title: string;
  author: string;
  repo: string;          // owner/repo
  branch: string;
  pathFilter: (path: string) => boolean;
  urlFor: (path: string) => string;
}

const SOURCES: Record<string, DocSource> = {
  "react-router": {
    id: "react-router",
    title: "React Router v7 — Official Docs",
    author: "Remix team / React Router contributors",
    repo: "remix-run/react-router",
    branch: "main",
    pathFilter: (p) => p.startsWith("docs/") && p.endsWith(".md"),
    urlFor: (p) => `https://reactrouter.com/${p.replace(/^docs\//, "").replace(/\.md$/, "")}`,
  },
  "tailwind": {
    id: "tailwind",
    title: "Tailwind CSS v4 — Official Docs",
    author: "Tailwind Labs",
    repo: "tailwindlabs/tailwindcss.com",
    branch: "main",
    pathFilter: (p) => p.startsWith("src/docs/") && (p.endsWith(".mdx") || p.endsWith(".md")),
    urlFor: (p) => {
      const slug = p.replace(/^src\/docs\//, "").replace(/\.mdx?$/, "");
      return `https://tailwindcss.com/docs/${slug}`;
    },
  },
};

interface Args { source?: string; force?: boolean; concurrency: number; }

function printHelp(): void {
  console.error(`Usage: bun fetch-tech-docs.ts [--source react-router|tailwind] [--force] [--concurrency N]

Pulls live docs from GitHub for the listed sources. Each source becomes one
"book" addressable by --book in search.ts/page.ts.

Options:
  --source NAME     react-router | tailwind (default: both)
  --force           Re-fetch even if <source>.json exists
  --concurrency N   Parallel GitHub API requests (default: 12)
  -h, --help        Show this help

Exit: 0 ok | 1 fetch failed | 2 bad args | 3 gh CLI missing or unauthenticated`);
}

function parseArgs(argv: string[]): Args {
  const a: Args = { concurrency: 12 };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--source") a.source = argv[++i];
    else if (x === "--force") a.force = true;
    else if (x === "--concurrency") a.concurrency = Number(argv[++i]);
    else if (x === "-h" || x === "--help") { printHelp(); process.exit(0); }
    else { console.error(`Error: unknown flag: ${x}`); process.exit(2); }
  }
  if (a.source && !SOURCES[a.source]) {
    console.error(`Error: --source must be one of: ${Object.keys(SOURCES).join(", ")}`);
    process.exit(2);
  }
  return a;
}

// Verify gh CLI is available + authed (sources are public, but gh gives us the higher rate limit)
async function checkGh(): Promise<void> {
  const proc = Bun.spawnSync(["gh", "auth", "status"], { stdout: "ignore", stderr: "ignore" });
  if (proc.exitCode !== 0) {
    console.error("Error: gh CLI is missing or unauthenticated. Install + run `gh auth login`.");
    process.exit(3);
  }
}

interface TreeEntry { path: string; type: string; sha: string; }

async function listFiles(source: DocSource): Promise<string[]> {
  const proc = Bun.spawnSync([
    "gh", "api",
    `repos/${source.repo}/git/trees/${source.branch}?recursive=1`,
    "--jq", ".tree[]",
  ], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    console.error(`Error listing ${source.repo}: ${proc.stderr.toString()}`);
    process.exit(1);
  }
  const lines = proc.stdout.toString().trim().split("\n");
  return lines
    .map(l => { try { return JSON.parse(l) as TreeEntry; } catch { return null; } })
    .filter((e): e is TreeEntry => e !== null && e.type === "blob" && source.pathFilter(e.path))
    .map(e => e.path)
    .sort();
}

async function fetchOne(source: DocSource, path: string): Promise<string> {
  // raw.githubusercontent needs no auth for public repos and fetch() is genuinely
  // concurrent — Bun.spawnSync(gh) serialized every request despite Promise.all.
  const url = `https://raw.githubusercontent.com/${source.repo}/${source.branch}/${path}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`fetch failed for ${path}: HTTP ${r.status}`);
  return await r.text();
}

function cleanMdx(raw: string): string {
  // Strip MDX import / export lines (noise for search; keep the markdown content + JSX literals)
  let s = raw
    .replace(/^---[\s\S]*?---\n/m, "")                      // strip frontmatter (front-of-file YAML)
    .replace(/^import\s+[^;]+;\s*$/gm, "")                  // strip "import X from Y;"
    .replace(/^export\s+const\s+\w+\s*=\s*[^;]+;\s*$/gm, "") // strip "export const X = ..."
    .replace(/<!--[\s\S]*?-->/g, "")                        // strip HTML comments
    .replace(/^\s*\n/gm, "")                                // collapse blank-only lines at line-start
    .replace(/\n{3,}/g, "\n\n")                             // collapse 3+ newlines to 2
    .trim();
  return s;
}

async function fetchSource(source: DocSource, force: boolean, concurrency: number): Promise<void> {
  const destMd = join(DEST_DIR, `${source.id}.md`);
  const destJson = join(DEST_DIR, `${source.id}.json`);
  if (!force && await Bun.file(destJson).exists()) {
    console.error(`[skip] ${source.id} — ${destJson} exists. Use --force to re-fetch.`);
    return;
  }

  console.error(`[${source.id}] listing files in ${source.repo}@${source.branch}...`);
  const paths = await listFiles(source);
  console.error(`[${source.id}] ${paths.length} files to fetch`);

  const pages: { page: number; path: string; url: string; text: string }[] = [];

  for (let i = 0; i < paths.length; i += concurrency) {
    const batch = paths.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (p, idx) => {
      try {
        const raw = await fetchOne(source, p);
        const text = cleanMdx(raw);
        return { page: i + idx + 1, path: p, url: source.urlFor(p), text };
      } catch (e) {
        console.error(`  ! ${p}: ${(e as Error).message}`);
        return { page: i + idx + 1, path: p, url: source.urlFor(p), text: "" };
      }
    }));
    pages.push(...results);
    if (i % 60 === 0 || i + concurrency >= paths.length) {
      console.error(`  ${Math.min(i + concurrency, paths.length)}/${paths.length}`);
    }
  }

  await mkdir(DEST_DIR, { recursive: true });

  const totalChars = pages.reduce((a, p) => a + p.text.length, 0);

  // Cache JSON — matches the shape the search/page scripts expect
  const cache = {
    id: source.id,
    title: source.title,
    author: source.author,
    domain: "tech-docs",
    source: `https://github.com/${source.repo}`,
    fetched: new Date().toISOString(),
    pages: pages.map(p => ({ page: p.page, text: p.text, path: p.path, url: p.url })),
  };
  await Bun.write(destJson, JSON.stringify(cache, null, 2));

  // Human-readable markdown (handy if user wants to grep manually)
  const md = `# ${source.title}\n\nAuthor: ${source.author}\nSource: https://github.com/${source.repo}\nBranch: ${source.branch}\nFetched: ${cache.fetched}\nPages: ${pages.length}\n\n---\n\n` +
    pages.map(p => `## Page ${p.page} — \`${p.path}\`\n\nLive URL: ${p.url}\n\n${p.text}`).join("\n\n---\n\n");
  await Bun.write(destMd, md);

  console.error(`[${source.id}] ✓ ${pages.length} pages, ${totalChars.toLocaleString()} chars → ${destJson.replace(LIBRARY, "library")}`);
}

const args = parseArgs(Bun.argv.slice(2));
await checkGh();

const targets = args.source ? [SOURCES[args.source]!] : Object.values(SOURCES);
for (const src of targets) await fetchSource(src, !!args.force, args.concurrency);

console.log(JSON.stringify({
  fetched: targets.map(s => s.id),
  destDir: DEST_DIR,
  nextStep: `bun ${resolve(import.meta.dir, "embed.ts")} --book ${targets.map(s => s.id).join(` && bun ${resolve(import.meta.dir, "embed.ts")} --book `)}`,
}, null, 2));
