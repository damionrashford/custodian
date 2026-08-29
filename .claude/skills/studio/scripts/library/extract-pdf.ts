#!/usr/bin/env bun
/**
 * extract.ts — extract per-page text from the three design books into a cache.
 *
 * Idempotent: skips books whose cache file already exists unless --force.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/library/extract-pdf.ts [--force] [--verbose]
 *
 * Output: <book-id>.json written next to each source PDF under knowledge/books/.
 *   { id, title, author, pdf, pages: [{ page: 1, text: "..." }, ...] }
 */

import { extractText, getDocumentProxy } from "../../lib/vendor/unpdf.mjs";
import { join, resolve } from "node:path";

interface Book {
  id: string;
  title: string;
  author: string;
  domain: string;
  pdf: string;
}

const LIBRARY = resolve(import.meta.dir, "..", "..", "knowledge", "books");

const BOOKS: Book[] = [
  // ui-visual
  { id: "refactoring-ui", title: "Refactoring UI", author: "Adam Wathan & Steve Schoger",
    domain: "ui-visual", pdf: join(LIBRARY, "ui-visual", "refactoring-ui.pdf") },
  // ux-fundamentals
  { id: "design-of-everyday-things", title: "The Design of Everyday Things", author: "Don Norman",
    domain: "ux-fundamentals", pdf: join(LIBRARY, "ux-fundamentals", "design-of-everyday-things.pdf") },
  { id: "dont-make-me-think", title: "Don't Make Me Think, Revisited (3rd ed)", author: "Steve Krug",
    domain: "ux-fundamentals", pdf: join(LIBRARY, "ux-fundamentals", "dont-make-me-think.pdf") },
  { id: "universal-principles", title: "Universal Principles of Design", author: "Lidwell, Holden & Butler",
    domain: "ux-fundamentals", pdf: join(LIBRARY, "ux-fundamentals", "universal-principles.pdf") },
  { id: "about-face", title: "About Face: The Essentials of Interaction Design (4th ed)", author: "Cooper, Reimann, Cronin & Noessel",
    domain: "ux-fundamentals", pdf: join(LIBRARY, "ux-fundamentals", "about-face.pdf") },
  // psychology-behavior
  { id: "100-things", title: "100 Things Every Designer Needs to Know About People", author: "Susan Weinschenk",
    domain: "psychology-behavior", pdf: join(LIBRARY, "psychology-behavior", "100-things.pdf") },
  { id: "laws-of-ux", title: "Laws of UX", author: "Jon Yablonski",
    domain: "psychology-behavior", pdf: join(LIBRARY, "psychology-behavior", "laws-of-ux.pdf") },
  { id: "mind-in-mind", title: "Designing with the Mind in Mind", author: "Jeff Johnson",
    domain: "psychology-behavior", pdf: join(LIBRARY, "psychology-behavior", "mind-in-mind.pdf") },
  { id: "hooked", title: "Hooked: How to Build Habit-Forming Products", author: "Nir Eyal",
    domain: "psychology-behavior", pdf: join(LIBRARY, "psychology-behavior", "hooked.pdf") },
  // typography
  { id: "thinking-with-type", title: "Thinking with Type", author: "Ellen Lupton",
    domain: "typography", pdf: join(LIBRARY, "typography", "thinking-with-type.pdf") },
  { id: "elements-of-typographic-style", title: "The Elements of Typographic Style", author: "Robert Bringhurst",
    domain: "typography", pdf: join(LIBRARY, "typography", "elements-of-typographic-style.pdf") },
  { id: "grid-systems", title: "Grid Systems in Graphic Design", author: "Josef Müller-Brockmann",
    domain: "typography", pdf: join(LIBRARY, "typography", "grid-systems.pdf") },
  // color-theory
  { id: "interaction-of-color", title: "Interaction of Color", author: "Josef Albers",
    domain: "color-theory", pdf: join(LIBRARY, "color-theory", "interaction-of-color.pdf") },
  { id: "designers-dictionary-of-color", title: "The Designer's Dictionary of Color", author: "Sean Adams",
    domain: "color-theory", pdf: join(LIBRARY, "color-theory", "designers-dictionary-of-color.pdf") },
  // Web-sourced books are populated by fetch-atomic-design.ts and fetch-web-book.ts:
  //   atomic-design       (design-systems)    — atomicdesign.bradfrost.com
  //   practical-typography (typography)        — practicaltypography.com
  //   resilient-web-design (web-frontend)      — resilientwebdesign.com
  //   web-style-guide     (web-frontend)      — webstyleguide.com/wsg3
  //   inclusive-components (web-frontend)     — inclusive-components.design
];

interface Args { force?: boolean; verbose?: boolean; }

function printHelp(): void {
  console.error(`Usage: bun extract-pdf.ts [--force] [--verbose]

Extracts per-page text from each PDF in library/<domain>/ into <id>.json
alongside the source PDF.

Options:
  --force      Re-extract even if JSON exists
  --verbose    Print per-book progress to stderr
  -h, --help   Show this help`);
}

function cachePathFor(book: Book): string {
  return book.pdf.replace(/\.pdf$/, ".json");
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const a of argv) {
    if (a === "--force") args.force = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "-h" || a === "--help") { printHelp(); process.exit(0); }
    else { console.error(`Error: unknown flag: ${a}`); printHelp(); process.exit(2); }
  }
  return args;
}

const args = parseArgs(Bun.argv.slice(2));
const log = (m: string): void => { if (args.verbose) console.error(m); };

const summary: { id: string; pages: number; cached: boolean }[] = [];

for (const book of BOOKS) {
  const cachePath = cachePathFor(book);
  const cacheFile = Bun.file(cachePath);
  if (!args.force && (await cacheFile.exists())) {
    const existing = await cacheFile.json();
    log(`[cache hit] ${book.id} (${existing.pages.length} pages)`);
    summary.push({ id: book.id, pages: existing.pages.length, cached: true });
    continue;
  }

  const pdfFile = Bun.file(book.pdf);
  if (!(await pdfFile.exists())) {
    console.error(`Error: PDF not found for ${book.id}: ${book.pdf}`);
    process.exit(1);
  }

  log(`[extract] ${book.id} from ${book.pdf}`);
  const buf = new Uint8Array(await pdfFile.arrayBuffer());
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((t, i) => ({ page: i + 1, text: t }));

  await Bun.write(cachePath, JSON.stringify({ ...book, pages }, null, 2));
  log(`[wrote] ${cachePath} (${pages.length} pages)`);
  summary.push({ id: book.id, pages: pages.length, cached: false });
}

console.log(JSON.stringify({ library: LIBRARY, books: summary }, null, 2));