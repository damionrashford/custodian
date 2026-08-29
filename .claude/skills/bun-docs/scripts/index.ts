#!/usr/bin/env bun
/**
 * index.ts — Build a BM25 search index from the cached Bun docs.
 *
 * Input:  ~/.cache/bun-docs/raw/**\/*.md     (populated by fetch.ts)
 *         ~/.cache/bun-docs/manifest.json
 * Output: ~/.cache/bun-docs/index.json       (BM25 inverted index)
 *
 * Chunking:
 *   - Split each doc by `## ` headings; each section becomes one chunk.
 *   - The doc title (first `# ` heading) is prepended to every chunk so a
 *     section like "## Reading files" still scores hits for queries like
 *     "Bun.file how to read".
 *
 * Tokenisation:
 *   - Lowercase, replace non-alphanumeric with whitespace, split on whitespace,
 *     drop tokens shorter than 2 chars.
 *   - Stoplist is intentionally small — Bun docs are dense and over-stopping
 *     hurts recall on terms like "fs" or "io".
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/index.ts            # full build
 *   bun ${CLAUDE_SKILL_DIR}/scripts/index.ts --verbose
 *
 * Output (stdout, JSON): { docs, chunks, terms, indexPath, sizeBytes }.
 */

import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_ROOT = join(homedir(), ".cache", "bun-docs");
const MANIFEST_PATH = join(CACHE_ROOT, "manifest.json");
const INDEX_PATH = join(CACHE_ROOT, "index.json");

interface ManifestEntry {
  url: string;
  source: string;
  file: string;
  bytes: number;
  fetchedAt: string;
  contentType: string;
}
interface Manifest {
  version: 1;
  fetchedAt: string;
  entries: Record<string, ManifestEntry>;
}

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
  /** term -> [chunkIndex, termFrequency][] */
  postings: Record<string, Array<[number, number]>>;
  /** term -> document frequency */
  df: Record<string, number>;
}

const STOPLIST = new Set([
  "the", "and", "for", "with", "that", "this", "from", "you", "your",
  "are", "was", "were", "but", "not", "have", "has", "had", "can", "will",
  "would", "could", "should", "their", "them", "they",
]);

interface Args {
  verbose?: boolean;
}

function printHelp(): void {
  console.error(`Usage: bun index.ts [OPTIONS]

Options:
  --verbose    Print per-doc progress to stderr
  -h, --help   Show this help`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verbose") args.verbose = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else if (a && a.startsWith("--")) {
      console.error(`Error: unknown flag: ${a}`);
      printHelp();
      process.exit(2);
    }
  }
  return args;
}

// Bun-native: Bun.argv per /docs/guides/process/argv.
const args = parseArgs(Bun.argv.slice(2));
const log = (msg: string): void => {
  if (args.verbose) console.error(msg);
};

function extractDocTitle(body: string): string {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m && m[1] ? m[1].trim() : "";
}

function splitIntoSections(body: string): Array<{ heading: string; body: string }> {
  const lines = body.split(/\r?\n/);
  const chunks: Array<{ heading: string; body: string }> = [];
  let curHeading = "";
  let buf: string[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m && m[1]) {
      if (buf.length > 0) {
        chunks.push({ heading: curHeading, body: buf.join("\n").trim() });
      }
      curHeading = m[1].trim();
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) {
    chunks.push({ heading: curHeading, body: buf.join("\n").trim() });
  }
  return chunks.filter((c) => c.body.length > 0);
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)) {
    if (raw.length < 2) continue;
    if (STOPLIST.has(raw)) continue;
    tokens.push(raw);
  }
  return tokens;
}

async function chunkId(url: string, section: string): Promise<string> {
  const data = new TextEncoder().encode(`${url}#${section}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildIndex(manifest: Manifest): Promise<SearchIndex> {
  const chunks: Chunk[] = [];
  // Use Maps to dodge prototype-pollution / property-collision footguns
  // for tokens like "constructor" or "__proto__" if they ever appear in
  // the corpus. Serialise to plain objects only at the final return.
  const postings = new Map<string, Array<[number, number]>>();
  const df = new Map<string, number>();

  const entries = Object.values(manifest.entries);
  let processed = 0;
  for (const entry of entries) {
    const absPath = join(CACHE_ROOT, entry.file);
    const file = Bun.file(absPath);
    if (!(await file.exists())) continue;
    const body = await file.text();
    const docTitle = extractDocTitle(body);
    const sections = splitIntoSections(body);

    for (const sec of sections) {
      const id = await chunkId(entry.url, sec.heading);
      const chunkIndex = chunks.length;
      const tokens = tokenize(`${docTitle} ${sec.heading} ${sec.body}`);
      chunks.push({
        id,
        url: entry.url,
        source: entry.source,
        docTitle,
        section: sec.heading,
        body: sec.body,
        length: tokens.length,
      });

      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const [term, count] of tf) {
        let list = postings.get(term);
        if (!list) {
          list = [];
          postings.set(term, list);
        }
        list.push([chunkIndex, count]);
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }
    processed++;
    if (processed % 25 === 0) log(`[index] ${processed}/${entries.length} docs`);
  }

  const totalLength = chunks.reduce((s, c) => s + c.length, 0);
  // Serialise Maps to plain objects for JSON. Object.fromEntries() is safe
  // because we'll only read these back via Object.keys / direct lookup at
  // search time — never via prototype methods.
  return {
    version: 2,
    builtAt: new Date().toISOString(),
    k1: 1.2,
    b: 0.75,
    n: chunks.length,
    avgdl: chunks.length === 0 ? 0 : totalLength / chunks.length,
    chunks,
    postings: Object.fromEntries(postings),
    df: Object.fromEntries(df),
  };
}

async function main(): Promise<void> {
  const manifestFile = Bun.file(MANIFEST_PATH);
  if (!(await manifestFile.exists())) {
    console.error("Error: no manifest at " + MANIFEST_PATH);
    console.error("Run fetch.ts first.");
    process.exit(1);
  }
  const manifest = (await manifestFile.json()) as Manifest;
  log(`[index] manifest lists ${Object.keys(manifest.entries).length} pages`);

  const index = await buildIndex(manifest);
  const json = JSON.stringify(index);
  const bytes = await Bun.write(INDEX_PATH, json);

  console.log(
    JSON.stringify({
      docs: Object.keys(manifest.entries).length,
      chunks: index.n,
      terms: Object.keys(index.df).length,
      avgChunkLength: Math.round(index.avgdl),
      indexPath: INDEX_PATH,
      sizeBytes: bytes,
    }, null, 2),
  );
}

await main();
