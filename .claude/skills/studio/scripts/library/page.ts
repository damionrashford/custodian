#!/usr/bin/env bun
/**
 * page.ts — fetch the full text of a specific page (or range) from a book.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/library/page.ts --book refactoring-ui --page 42
 *   bun ${CLAUDE_SKILL_DIR}/scripts/library/page.ts --book laws-of-ux --from 10 --to 15
 *
 * Exit codes: 0 ok | 1 page not found | 2 bad args | 3 cache missing
 */

import { join, resolve } from "node:path";

const LIBRARY = resolve(import.meta.dir, "..", "..", "knowledge");
const BOOK_GLOBS = ["books/*/*.json", "rules/*.json"];
async function discoverBookIds(): Promise<string[]> {
  const ids: string[] = [];
  for (const pattern of BOOK_GLOBS) {
    const g = new Bun.Glob(pattern);
    for await (const rel of g.scan({ cwd: LIBRARY })) {
      if (rel.endsWith(".embeddings.json")) continue;
      ids.push(rel.split("/").pop()!.replace(/\.json$/, ""));
    }
  }
  return ids.sort();
}
const BOOK_IDS = await discoverBookIds();
type BookId = string;

interface Args { book?: BookId; page?: number; from?: number; to?: number; }

function printHelp(): void {
  console.error(`Usage: bun page.ts --book ID (--page N | --from N --to N)

Options:
  --book ID    refactoring-ui | laws-of-ux | 100-things
  --page N     Single page number (1-indexed)
  --from N     Range start
  --to N       Range end (inclusive)
  -h, --help   Show this help

Exit: 0 ok | 1 page not found | 2 bad args | 3 cache missing`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--book") {
      const b = argv[++i] as BookId;
      if (!BOOK_IDS.includes(b)) { console.error(`Error: --book must be one of: ${BOOK_IDS.join(", ")}`); process.exit(2); }
      args.book = b;
    } else if (a === "--page") args.page = Number(argv[++i]);
    else if (a === "--from") args.from = Number(argv[++i]);
    else if (a === "--to") args.to = Number(argv[++i]);
    else if (a === "-h" || a === "--help") { printHelp(); process.exit(0); }
    else { console.error(`Error: unknown flag: ${a}`); process.exit(2); }
  }
  if (!args.book) { console.error("Error: --book is required"); printHelp(); process.exit(2); }
  if (args.page === undefined && (args.from === undefined || args.to === undefined)) {
    console.error("Error: provide either --page N, or both --from N --to N");
    process.exit(2);
  }
  return args;
}

const args = parseArgs(Bun.argv.slice(2));

async function findBookJson(id: string): Promise<string | null> {
  for (const pattern of [`books/*/${id}.json`, `rules/${id}.json`]) {
    const glob = new Bun.Glob(pattern);
    for await (const rel of glob.scan({ cwd: LIBRARY })) return join(LIBRARY, rel);
  }
  return null;
}

const bookPath = await findBookJson(args.book!);
if (!bookPath) {
  console.error(`Error: index missing for ${args.book}. Run: bun ${resolve(import.meta.dir, "extract-pdf.ts")}`);
  process.exit(3);
}
const book = await Bun.file(bookPath).json();

const from = args.page ?? args.from!;
const to = args.page ?? args.to!;
if (from > to) { console.error("Error: --from must be <= --to"); process.exit(2); }

const pages = book.pages.filter((p: { page: number }) => p.page >= from && p.page <= to);
if (pages.length === 0) {
  console.error(`Error: no pages ${from}-${to} in ${args.book} (book has ${book.pages.length} pages)`);
  process.exit(1);
}

console.log(JSON.stringify({
  book: book.id, title: book.title, author: book.author,
  range: { from, to }, pages,
}, null, 2));