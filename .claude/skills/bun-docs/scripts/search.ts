#!/usr/bin/env bun
/**
 * search.ts — BM25 query against the local Bun docs index.
 *
 * Loads ~/.cache/bun-docs/index.json (built by index.ts), scores chunks
 * against the query, and returns the top-N matching SECTION BODIES — not
 * just URLs. The agent reads the body directly and answers the user; no
 * second fetch needed.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "how do I use Bun.file"
 *   bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "bun install --frozen-lockfile" --limit 3
 *   bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "splice sendfile" --source docs --markdown
 *
 * Options:
 *   --limit N        Max results (default 5).
 *   --min-score N    Minimum normalized score [0..1) (default 0).
 *   --source NAME    Restrict to one source: docs | reference | blog.
 *   --markdown       Human-readable output instead of JSON.
 *   --verbose        Print scoring details to stderr.
 *
 * BM25 normalisation follows qmd's formula: |bm25| / (1 + |bm25|) for a
 * stable [0..1) range. Returns JSON by default.
 */

import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_ROOT = join(homedir(), ".cache", "bun-docs");
const INDEX_PATH = join(CACHE_ROOT, "index.json");

interface Chunk {
  id: string;
  url: string;
  source: string;
  docTitle: string;
  section: string;
  body: string;
  length: number;
}
interface SearchIndex {
  version: 2;
  builtAt: string;
  k1: number;
  b: number;
  n: number;
  avgdl: number;
  chunks: Chunk[];
  postings: Record<string, Array<[number, number]>>;
  df: Record<string, number>;
}

const STOPLIST = new Set([
  "the", "and", "for", "with", "that", "this", "from", "you", "your",
  "are", "was", "were", "but", "not", "have", "has", "had", "can", "will",
  "would", "could", "should", "their", "them", "they",
]);

interface Args {
  query: string;
  limit: number;
  minScore: number;
  source?: string;
  markdown?: boolean;
  verbose?: boolean;
}

function printHelp(): void {
  console.error(`Usage: bun search.ts "QUERY" [OPTIONS]

Options:
  --limit N          Max results (default 5)
  --min-score N      Min normalized score 0..1 (default 0)
  --source NAME      Restrict to docs | reference | blog
  --markdown         Human-readable output instead of JSON
  --verbose          Print scoring breakdown to stderr
  -h, --help         Show this help`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { query: "", limit: 5, minScore: 0 };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") args.limit = parseInt(argv[++i] ?? "5", 10);
    else if (a === "--min-score") args.minScore = parseFloat(argv[++i] ?? "0");
    else if (a === "--source") args.source = argv[++i];
    else if (a === "--markdown") args.markdown = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else if (a && a.startsWith("--")) {
      console.error(`Error: unknown flag: ${a}`);
      printHelp();
      process.exit(2);
    } else if (a) {
      positional.push(a);
    }
  }
  args.query = positional.join(" ").trim();
  return args;
}

// Bun-native: Bun.argv per /docs/guides/process/argv.
const args = parseArgs(Bun.argv.slice(2));
const log = (msg: string): void => {
  if (args.verbose) console.error(msg);
};

if (!args.query) {
  console.error("Error: missing query");
  printHelp();
  process.exit(2);
}

function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)) {
    if (raw.length < 2) continue;
    if (STOPLIST.has(raw)) continue;
    out.push(raw);
  }
  return out;
}

interface ScoredHit {
  chunkIndex: number;
  rawScore: number;
  score: number;
  matchedTerms: string[];
}

function score(index: SearchIndex, queryTokens: string[]): ScoredHit[] {
  const { k1, b, n, avgdl, postings, df, chunks } = index;
  // De-dupe query tokens — repeats don't add information for BM25 scoring.
  const uniqueTerms = Array.from(new Set(queryTokens));

  // Aggregate: chunkIndex -> { rawScore, matchedTerms }
  const acc = new Map<number, { rawScore: number; matched: Set<string> }>();
  for (const term of uniqueTerms) {
    const posting = postings[term];
    if (!posting) continue;
    const dfTerm = df[term] ?? 0;
    if (dfTerm === 0) continue;
    // Standard BM25 IDF with the "+0.5" smoothing to avoid negatives for rare terms.
    const idf = Math.log(1 + (n - dfTerm + 0.5) / (dfTerm + 0.5));
    for (const [chunkIndex, tf] of posting) {
      const dl = chunks[chunkIndex]!.length;
      const denom = tf + k1 * (1 - b + b * (dl / (avgdl || 1)));
      const termScore = idf * ((tf * (k1 + 1)) / denom);
      const cur = acc.get(chunkIndex);
      if (cur) {
        cur.rawScore += termScore;
        cur.matched.add(term);
      } else {
        acc.set(chunkIndex, { rawScore: termScore, matched: new Set([term]) });
      }
    }
  }

  const hits: ScoredHit[] = [];
  for (const [chunkIndex, { rawScore, matched }] of acc) {
    const absScore = Math.abs(rawScore);
    const normalized = absScore / (1 + absScore); // qmd-style normalisation
    hits.push({
      chunkIndex,
      rawScore,
      score: normalized,
      matchedTerms: Array.from(matched),
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

async function main(): Promise<void> {
  const file = Bun.file(INDEX_PATH);
  if (!(await file.exists())) {
    console.error("Error: no index at " + INDEX_PATH);
    console.error("Run fetch.ts and index.ts first.");
    process.exit(1);
  }
  const index = (await file.json()) as SearchIndex;
  log(`[search] index v${index.version}: ${index.n} chunks, ${Object.keys(index.df).length} terms`);

  const queryTokens = tokenize(args.query);
  if (queryTokens.length === 0) {
    console.error("Error: query has no indexable terms (too short, all stopwords?)");
    process.exit(2);
  }
  log(`[search] tokens: ${queryTokens.join(" ")}`);

  const allHits = score(index, queryTokens);

  // Apply --source filter and --min-score, take top --limit.
  const filtered: Array<{ hit: ScoredHit; chunk: Chunk }> = [];
  for (const hit of allHits) {
    if (hit.score < args.minScore) continue;
    const chunk = index.chunks[hit.chunkIndex]!;
    if (args.source && chunk.source !== args.source) continue;
    filtered.push({ hit, chunk });
    if (filtered.length >= args.limit) break;
  }

  if (args.markdown) {
    // Bun-native incremental write to stdout. Bun.stdout is a BunFile (per
    // /docs/runtime/file-io); .writer() returns a FileSink we can push
    // multiple chunks into and end() once at the bottom.
    const out = Bun.stdout.writer();
    for (const { hit, chunk } of filtered) {
      const heading = chunk.section ? `${chunk.docTitle} / ${chunk.section}` : chunk.docTitle;
      out.write(`\n## ${heading}  \n`);
      out.write(`\`${chunk.url}\`  (score ${hit.score.toFixed(3)}, terms: ${hit.matchedTerms.join(", ")})\n\n`);
      out.write(chunk.body);
      out.write("\n\n---\n");
    }
    await out.end();
  } else {
    const out = {
      query: args.query,
      tokens: queryTokens,
      total: filtered.length,
      hits: filtered.map(({ hit, chunk }) => ({
        id: chunk.id,
        url: chunk.url,
        source: chunk.source,
        docTitle: chunk.docTitle,
        section: chunk.section,
        score: Number(hit.score.toFixed(4)),
        matchedTerms: hit.matchedTerms,
        body: chunk.body,
      })),
    };
    console.log(JSON.stringify(out, null, 2));
  }
}

await main();
