#!/usr/bin/env bun
/**
 * embed.ts — generate per-page embeddings via Ollama, store next to each book index.
 *
 * Reads:  library/<domain>/<book-id>.json  (page text written by extract.ts)
 * Writes: library/<domain>/<book-id>.embeddings.json
 *
 * Usage:
 *   bun embed.ts                       # all books + rules; skips fresh embeddings, re-embeds stale (source newer) + heals null chunks
 *   bun embed.ts --force               # re-embed everything
 *   bun embed.ts --book <id>           # one book
 *   bun embed.ts --model mxbai-embed-large  # override model (default nomic-embed-text)
 *
 * nomic-embed-text requires task-instruction prefixes: documents are embedded
 * with "search_document: " and queries (in search.ts) with "search_query: ".
 * The prefix is applied automatically when the model name contains "nomic".
 * If you change the model, re-embed (--force) AND keep search.ts in sync.
 *
 * Requires Ollama running at localhost:11434 with the embedding model pulled.
 * Pages with empty text are stored as { page, embedding: null }.
 */

import { join, resolve } from "node:path";

const LIBRARY = resolve(import.meta.dir, "..", "..", "knowledge");
// Books AND studio rules — rules must be semantically retrievable too, or the
// per-STEP hybrid searches never surface the skill's own guidance.
const BOOK_GLOBS = ["books/*/*.json", "rules/*.json"];
const OLLAMA = process.env.OLLAMA_HOST ?? "http://localhost:11434";

interface Args { force?: boolean; book?: string; model: string; concurrency: number; chunkChars: number; overlap: number; }

function printHelp(): void {
  console.error(`Usage: bun embed.ts [--force] [--book <id>] [--model <name>] [--concurrency N]

Generates per-chunk embeddings via Ollama. Pages over --chunk-chars are split
into overlapping chunks. Writes <book-id>.embeddings.json next to each
<book-id>.json in library/<domain>/.

Options:
  --force            Re-embed even if embeddings file exists
  --book ID          Embed only this book
  --model NAME       Ollama embedding model (default: nomic-embed-text, 8K ctx)
  --concurrency N    Parallel embedding requests (default: 4)
  --chunk-chars N    Max chars per chunk (default: 3000, ~1000 tokens)
  --overlap N        Overlap between chunks (default: 300)
  -h, --help         Show this help

Exit: 0 ok | 1 ollama unreachable | 2 bad args | 3 source missing`);
}

function parseArgs(argv: string[]): Args {
  const a: Args = { model: "nomic-embed-text", concurrency: 4, chunkChars: 3000, overlap: 300 };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--force") a.force = true;
    else if (x === "--book") a.book = argv[++i];
    else if (x === "--model") a.model = argv[++i];
    else if (x === "--concurrency") a.concurrency = Number(argv[++i]);
    else if (x === "--chunk-chars") a.chunkChars = Number(argv[++i]);
    else if (x === "--overlap") a.overlap = Number(argv[++i]);
    else if (x === "-h" || x === "--help") { printHelp(); process.exit(0); }
    else { console.error(`Error: unknown flag: ${x}`); process.exit(2); }
  }
  return a;
}

function chunkText(text: string, maxChars: number, overlap: number): string[] {
  const t = text.trim();
  if (t.length <= maxChars) return [t];
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    let end = Math.min(i + maxChars, t.length);
    // Try to break on a paragraph or sentence boundary
    if (end < t.length) {
      const slice = t.slice(i, end);
      const lastPara = slice.lastIndexOf("\n\n");
      const lastSent = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
      const breakPoint = lastPara > maxChars * 0.5 ? lastPara : (lastSent > maxChars * 0.5 ? lastSent + 1 : -1);
      if (breakPoint > 0) end = i + breakPoint;
    }
    chunks.push(t.slice(i, end).trim());
    if (end >= t.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks.filter(c => c.length >= 20);
}

const args = parseArgs(Bun.argv.slice(2));

// Check Ollama
try {
  const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (e) {
  console.error(`Error: Ollama unreachable at ${OLLAMA} (${(e as Error).message}). Start with: ollama serve`);
  process.exit(1);
}

// nomic-embed-text was trained with asymmetric task prefixes. Documents must be
// embedded with "search_document: "; queries (search.ts) use "search_query: ".
// Skipping them costs retrieval quality. Other models get no prefix.
const DOC_PREFIX = /nomic/i.test(args.model) ? "search_document: " : "";

async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: args.model, prompt: DOC_PREFIX + text }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  const { embedding } = await res.json() as { embedding: number[] };
  return embedding;
}

// Discover books — scan books/<cat>/*.json AND rules/*.json.
const sources: string[] = [];
for (const pattern of BOOK_GLOBS) {
  const glob = new Bun.Glob(pattern);
  for await (const rel of glob.scan({ cwd: LIBRARY })) {
    if (rel.endsWith(".embeddings.json")) continue;
    if (args.book && !rel.endsWith(`/${args.book}.json`)) continue;
    sources.push(join(LIBRARY, rel));
  }
}
if (sources.length === 0) {
  console.error(`Error: no books found${args.book ? ` matching --book ${args.book}` : ""}`);
  process.exit(3);
}

const summary: { id: string; chunks: number; embedded: number; failed: number; cached: boolean }[] = [];

for (const srcPath of sources) {
  const embPath = srcPath.replace(/\.json$/, ".embeddings.json");
  // Content-hash staleness (wyhash) — mtimes lie across git checkouts and copies;
  // the hash of the source json is the truth about whether embeddings match it.
  const srcText = await Bun.file(srcPath).text();
  const book = JSON.parse(srcText) as { id: string; pages: { page: number; text: string }[] };
  const srcHash = Bun.hash(srcText).toString();
  const embExists = await Bun.file(embPath).exists();
  let existingFile: any = null;
  if (embExists) existingFile = await Bun.file(embPath).json();
  const embStale = !existingFile || existingFile.src_hash !== srcHash;
  if (!args.force && embExists && !embStale) {
    const existing = existingFile;
    const nulls: any[] = existing.items.filter((i: any) => !i.embedding);
    if (nulls.length === 0) {
      console.error(`[cached] ${book.id} (${existing.items.length} chunks)`);
      summary.push({ id: book.id, chunks: existing.items.length, embedded: existing.items.length, failed: 0, cached: true });
      continue;
    }
    // Heal a partially-failed run: re-embed only the null chunks in place.
    console.error(`[heal] ${book.id}: re-embedding ${nulls.length} failed chunk(s)`);
    for (const item of existing.items) {
      if (item.embedding) continue;
      try { item.embedding = await embed(item.text); }
      catch (e) { console.error(`  ! p${item.page} c${item.chunkIdx} failed again: ${(e as Error).message}`); }
    }
    existing.src_hash = srcHash;
    await Bun.write(embPath, JSON.stringify(existing));
    const healed = existing.items.filter((i: any) => i.embedding).length;
    summary.push({ id: book.id, chunks: existing.items.length, embedded: healed, failed: existing.items.length - healed, cached: true });
    continue;
  }

  // Expand pages into chunks
  type Unit = { page: number; chunkIdx: number; text: string };
  const units: Unit[] = [];
  for (const p of book.pages) {
    const text = (p.text ?? "").trim();
    if (text.length < 20) continue;
    const chunks = chunkText(text, args.chunkChars, args.overlap);
    chunks.forEach((c, idx) => units.push({ page: p.page, chunkIdx: idx, text: c }));
  }

  console.error(`[embed] ${book.id} (${book.pages.length} pages → ${units.length} chunks, model=${args.model})`);
  const items: { page: number; chunkIdx: number; text: string; embedding: number[] | null }[] = [];

  for (let i = 0; i < units.length; i += args.concurrency) {
    const batch = units.slice(i, i + args.concurrency);
    const results = await Promise.all(batch.map(async u => {
      try {
        return { ...u, embedding: await embed(u.text) };
      } catch (e) {
        console.error(`  ! p${u.page} c${u.chunkIdx} failed: ${(e as Error).message}`);
        return { ...u, embedding: null };
      }
    }));
    items.push(...results);
    if ((i + args.concurrency) % 40 === 0 || i + args.concurrency >= units.length) {
      console.error(`  ${Math.min(i + args.concurrency, units.length)}/${units.length}`);
    }
  }

  const embedded = items.filter(i => i.embedding).length;
  const dim = items.find(i => i.embedding)?.embedding?.length ?? 0;
  // compact JSON — pretty-printing float arrays is a 5× size tax on a 100MB+ corpus
  await Bun.write(embPath, JSON.stringify({ id: book.id, model: args.model, dim, src_hash: srcHash, items }));
  console.error(`  ✓ ${book.id}: ${embedded}/${units.length} chunks embedded (dim=${dim}) → ${embPath.replace(LIBRARY + "/", "")}`);
  summary.push({ id: book.id, chunks: units.length, embedded, failed: units.length - embedded, cached: false });
}

console.log(JSON.stringify({ model: args.model, books: summary }, null, 2));
