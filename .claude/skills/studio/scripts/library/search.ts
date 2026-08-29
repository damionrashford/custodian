#!/usr/bin/env bun
/**
 * search.ts — search the design library via regex / BM25 / semantic / hybrid.
 *
 * Default mode: hybrid (BM25 ⊕ semantic via Reciprocal Rank Fusion).
 *   - bm25:     lexical; good for exact terms, multi-word phrases, technical jargon.
 *   - semantic: conceptual; finds "shadow / elevation / depth" from one query.
 *   - hybrid:   RRF(bm25, semantic) — best general-purpose default.
 *   - regex:    legacy exact-phrase matching; fastest, no Ollama needed.
 *
 * Semantic + hybrid require library/<domain>/<book-id>.embeddings.json files
 * (built by embed.ts) and Ollama running at localhost:11434.
 *
 * Usage:
 *   bun search.ts "color contrast"
 *   bun search.ts --mode semantic "why do people scan and not read"
 *   bun search.ts --book laws-of-ux --mode bm25 "fitts"
 *   bun search.ts --mode hybrid --limit 5 "primary button styling"
 *
 * Exit codes: 0 ok | 1 no matches | 2 invalid args | 3 index missing
 */

import { join, resolve } from "node:path";

const LIBRARY = resolve(import.meta.dir, "..", "..", "knowledge");
const OLLAMA = process.env.OLLAMA_HOST ?? "http://localhost:11434";
// Scan both books/<category>/<book>.json and rules/<rule>.json.
const BOOK_GLOBS = ["books/*/*.json", "rules/*.json"];

// Discover available books + rules, mapping each id to its domain
// (books/<domain>/<id>.json → domain; rules/<id>.json → "rules").
async function discoverBooks(): Promise<Map<string, string>> {
  const byId = new Map<string, string>();
  for (const pattern of BOOK_GLOBS) {
    const g = new Bun.Glob(pattern);
    for await (const rel of g.scan({ cwd: LIBRARY })) {
      if (rel.endsWith(".embeddings.json")) continue;
      const parts = rel.split("/");
      const id = parts.pop()!.replace(/\.json$/, "");
      const domain = parts[0] === "rules" ? "rules" : parts[1] ?? "unknown";
      byId.set(id, domain);
    }
  }
  return byId;
}
const DOMAIN_BY_ID = await discoverBooks();
const BOOK_IDS = [...DOMAIN_BY_ID.keys()].sort();
const DOMAINS = [...new Set(DOMAIN_BY_ID.values())].sort();
type BookId = string;
type Mode = "regex" | "bm25" | "semantic" | "hybrid";

interface Args { query?: string; book?: BookId; domain?: string; limit: number; context: number; mode: Mode; rrfK: number; cite?: string; }

function printHelp(): void {
  console.error(`Usage: bun search.ts [OPTIONS] "query"

Options:
  --mode MODE     hybrid | bm25 | semantic | regex (default: hybrid)
  --book ID       Restrict to one book
  --domain NAME   Restrict to one domain (a books/ subdirectory, or "rules")
  --limit N       Total max results across the library (default: 10)
  --context N     Chars of snippet context around match (default: 200)
  --rrf-k N       RRF constant for hybrid (default: 60)
  --cite PATH     Append {ts,query,book,page,score} JSONL for every hit (auto-citation)
  -h, --help      Show this help

semantic/hybrid auto-fall-back to bm25 if Ollama is unreachable (exit 0, warns on stderr).

Exit: 0 ok | 1 no matches | 2 bad args | 3 index missing`);
}

function parseArgs(argv: string[]): Args {
  const a: Args = { limit: 10, context: 200, mode: "hybrid", rrfK: 60 };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--book") {
      const b = argv[++i] as BookId;
      if (!BOOK_IDS.includes(b)) { console.error(`Error: --book must be one of: ${BOOK_IDS.join(", ")}`); process.exit(2); }
      a.book = b;
    } else if (x === "--domain") {
      const d = argv[++i];
      if (!DOMAINS.includes(d)) { console.error(`Error: --domain must be one of: ${DOMAINS.join(", ")}`); process.exit(2); }
      a.domain = d;
    } else if (x === "--limit") a.limit = Number(argv[++i]);
    else if (x === "--context") a.context = Number(argv[++i]);
    else if (x === "--mode") {
      const m = argv[++i] as Mode;
      if (!["regex", "bm25", "semantic", "hybrid"].includes(m)) { console.error(`Error: --mode must be one of: regex, bm25, semantic, hybrid`); process.exit(2); }
      a.mode = m;
    } else if (x === "--rrf-k") a.rrfK = Number(argv[++i]);
    else if (x === "--cite") a.cite = argv[++i];
    else if (x === "-h" || x === "--help") { printHelp(); process.exit(0); }
    else if (x.startsWith("--")) { console.error(`Error: unknown flag: ${x}`); process.exit(2); }
    else if (!a.query) a.query = x;
    else { console.error("Error: only one query allowed (quote it)"); process.exit(2); }
  }
  if (!a.query) { console.error("Error: query is required"); printHelp(); process.exit(2); }
  for (const [name, v] of [["limit", a.limit], ["context", a.context], ["rrf-k", a.rrfK]] as const) {
    if (!Number.isFinite(v) || v <= 0) { console.error(`Error: --${name} must be a positive number`); process.exit(2); }
  }
  return a;
}

interface CachedBook { id: string; title: string; author: string; domain?: string; pages: { page: number; text: string }[]; }
interface EmbItem { page: number; chunkIdx: number; text: string; embedding: number[] | null; }
interface EmbFile { id: string; model: string; dim: number; items: EmbItem[]; }

async function loadBook(id: BookId): Promise<CachedBook> {
  // Books live at books/<cat>/<id>.json; rules at rules/<id>.json.
  for (const pattern of [`books/*/${id}.json`, `rules/${id}.json`]) {
    const glob = new Bun.Glob(pattern);
    for await (const rel of glob.scan({ cwd: LIBRARY })) {
      if (rel.endsWith(".embeddings.json")) continue;
      return await Bun.file(join(LIBRARY, rel)).json();
    }
  }
  console.error(`Error: index missing for ${id}. Run: bun ${resolve(import.meta.dir, "extract-pdf.ts")}`);
  process.exit(3);
}

async function loadEmbeddings(id: BookId): Promise<EmbFile | null> {
  for (const pattern of [`books/*/${id}.embeddings.json`, `rules/${id}.embeddings.json`]) {
    const glob = new Bun.Glob(pattern);
    for await (const rel of glob.scan({ cwd: LIBRARY })) {
      return await Bun.file(join(LIBRARY, rel)).json();
    }
  }
  return null;
}

function tokenize(s: string): string[] {
  const m = s.toLowerCase().match(/[a-z0-9]+/g);
  return (m ?? ([] as string[])).filter(t => t.length > 1);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Thrown when Ollama can't be reached; caught at dispatch to fall back to BM25.
class OllamaUnreachable extends Error {}

async function embedQuery(text: string, model: string): Promise<number[]> {
  // Mirror embed.ts: nomic needs the "search_query: " task prefix on queries.
  const prompt = /nomic/i.test(model) ? `search_query: ${text}` : text;
  let r: Response;
  try {
    r = await fetch(`${OLLAMA}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new OllamaUnreachable((e as Error).message);
  }
  if (!r.ok) throw new OllamaUnreachable(`Ollama embed failed (HTTP ${r.status}); is ${model} pulled?`);
  return (await r.json() as { embedding: number[] }).embedding;
}

function snippet(text: string, terms: string[], context: number): string {
  const lower = text.toLowerCase();
  let idx = -1, len = 0;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) { idx = i; len = t.length; }
  }
  if (idx < 0) {
    return text.slice(0, context).replace(/\s+/g, " ").trim() + (text.length > context ? "…" : "");
  }
  const start = Math.max(0, idx - Math.floor(context / 2));
  const end = Math.min(text.length, idx + len + Math.floor(context / 2));
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
}

const args = parseArgs(Bun.argv.slice(2));
const query = args.query!;
const qTokens = tokenize(query);
const targets: BookId[] = args.book
  ? [args.book]
  : args.domain
    ? BOOK_IDS.filter(id => DOMAIN_BY_ID.get(id) === args.domain)
    : [...BOOK_IDS];

// Load all books in parallel
const books = await Promise.all(targets.map(loadBook));
const bookById = new Map(books.map(b => [b.id, b]));

interface Doc { book: string; page: number; text: string; tokens: string[]; len: number; }
const docs: Doc[] = [];
for (const b of books) {
  for (const p of b.pages) {
    if (!p.text || p.text.trim().length < 20) continue;
    const toks = tokenize(p.text);
    if (toks.length < 5) continue;
    docs.push({ book: b.id, page: p.page, text: p.text, tokens: toks, len: toks.length });
  }
}

// --- BM25 ---
const N = docs.length;
const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(N, 1);
const df = new Map<string, number>();
for (const d of docs) for (const t of new Set(d.tokens)) df.set(t, (df.get(t) ?? 0) + 1);

function bm25Score(d: Doc): number {
  const k1 = 1.5, b = 0.75;
  const tf = new Map<string, number>();
  for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  let s = 0;
  for (const qt of qTokens) {
    const dft = df.get(qt) ?? 0;
    if (!dft) continue;
    const idf = Math.log((N - dft + 0.5) / (dft + 0.5) + 1);
    const f = tf.get(qt) ?? 0;
    s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avgLen));
  }
  return s;
}

interface Hit { book: string; page: number; score: number; snippet: string; }

async function runRegex(): Promise<Hit[]> {
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const hits: Hit[] = [];
  for (const d of docs) {
    if (!re.test(d.text)) continue;
    hits.push({ book: d.book, page: d.page, score: 1, snippet: snippet(d.text, [query.toLowerCase()], args.context) });
  }
  return hits.slice(0, args.limit);
}

async function runBM25(): Promise<Hit[]> {
  return bm25PageScores(args.limit);
}

async function loadCompatibleEmbeddings(): Promise<EmbFile[]> {
  const embFiles = (await Promise.all(targets.map(loadEmbeddings))).filter((e): e is EmbFile => e !== null);
  if (embFiles.length === 0) return [];
  // All files must share the query-embedding model + dim; mixed corpora would
  // cosine 768-dim queries against e.g. 1024-dim vectors and silently emit NaN.
  const model = embFiles[0]!.model, dim = embFiles[0]!.dim;
  const compatible = embFiles.filter(ef => ef.model === model && ef.dim === dim);
  const dropped = embFiles.length - compatible.length;
  if (dropped > 0) {
    console.error(`Warning: skipped ${dropped} embeddings file(s) with model/dim differing from ${model}/${dim}. Re-run embed.ts --force for a uniform corpus.`);
  }
  return compatible;
}

async function semanticPageScores(cap: number): Promise<Hit[]> {
  const embFiles = await loadCompatibleEmbeddings();
  if (embFiles.length === 0) return [];
  const model = embFiles[0]!.model;
  const qEmb = await embedQuery(query, model);
  type PageScore = { book: string; page: number; score: number; text: string };
  const best = new Map<string, PageScore>();
  for (const ef of embFiles) {
    for (const item of ef.items) {
      if (!item.embedding) continue;
      const score = cosine(qEmb, item.embedding);
      const key = `${ef.id}/${item.page}`;
      const prev = best.get(key);
      if (!prev || prev.score < score) best.set(key, { book: ef.id, page: item.page, score, text: item.text });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, cap).map(p => ({
    book: p.book, page: p.page, score: p.score,
    snippet: snippet(p.text, qTokens, args.context),
  }));
}

async function runSemantic(): Promise<Hit[]> {
  const embFiles = await loadCompatibleEmbeddings();
  if (embFiles.length === 0) {
    console.error(`Error: no embeddings found. Run: bun ${resolve(import.meta.dir, "embed.ts")}`);
    process.exit(3);
  }
  return semanticPageScores(args.limit);
}

async function runHybrid(): Promise<Hit[]> {
  const [bm25Hits, semHits] = await Promise.all([
    bm25PageScores(100),
    semanticPageScores(100),
  ]);
  if (semHits.length === 0) {
    console.error("Warning: no embeddings available — hybrid is running as pure BM25. Run embed.ts to restore the semantic leg.");
  }
  // Reciprocal Rank Fusion
  const k = args.rrfK;
  const rrf = new Map<string, { book: string; page: number; score: number }>();
  bm25Hits.forEach((h, rank) => {
    const key = `${h.book}/${h.page}`;
    rrf.set(key, { book: h.book, page: h.page, score: (rrf.get(key)?.score ?? 0) + 1 / (k + rank) });
  });
  semHits.forEach((h, rank) => {
    const key = `${h.book}/${h.page}`;
    rrf.set(key, { book: h.book, page: h.page, score: (rrf.get(key)?.score ?? 0) + 1 / (k + rank) });
  });
  const sorted = [...rrf.values()].sort((a, b) => b.score - a.score).slice(0, args.limit);
  return sorted.map(r => {
    const doc = docs.find(d => d.book === r.book && d.page === r.page);
    const text = doc?.text ?? "";
    return { book: r.book, page: r.page, score: r.score, snippet: snippet(text, qTokens, args.context) };
  });
}

function bm25PageScores(cap: number): Hit[] {
  const scored = docs.map(d => ({ d, score: bm25Score(d) })).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map(x => ({
    book: x.d.book, page: x.d.page, score: x.score,
    snippet: snippet(x.d.text, qTokens, args.context),
  }));
}

async function dispatch(mode: Mode): Promise<Hit[]> {
  if (mode === "regex") return runRegex();
  if (mode === "bm25") return runBM25();
  if (mode === "semantic") return runSemantic();
  return runHybrid();
}

let hits: Hit[];
let effectiveMode: Mode = args.mode;
try {
  hits = await dispatch(args.mode);
} catch (e) {
  // Ollama down? Degrade to BM25 rather than blocking the whole design run.
  if (e instanceof OllamaUnreachable && (args.mode === "semantic" || args.mode === "hybrid")) {
    console.error(`Warning: ${e.message}. Falling back to --mode bm25.`);
    effectiveMode = "bm25";
    hits = await runBM25();
  } else throw e;
}

if (hits.length === 0) {
  console.error(`No matches for "${query}" (mode=${effectiveMode})`);
  process.exit(1);
}

const matches = hits.map(h => {
  const b = bookById.get(h.book)!;
  return { book: h.book, title: b.title, author: b.author, domain: b.domain ?? null, page: h.page, score: Number(h.score.toFixed(4)), snippet: h.snippet };
});

// Auto-citation: append compact tuples so state.citations is never transcribed by hand.
if (args.cite) {
  const { appendFileSync, mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(resolve(args.cite)) , { recursive: true });
  const ts = new Date().toISOString();
  const lines = matches.map(m => JSON.stringify({ ts, query, mode: effectiveMode, book: m.book, page: m.page, score: m.score }) + "\n").join("");
  appendFileSync(args.cite, lines);
}

console.log(JSON.stringify({ query, mode: effectiveMode, totalMatches: matches.length, matches }, null, 2));
