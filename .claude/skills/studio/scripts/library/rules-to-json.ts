#!/usr/bin/env bun
/**
 * rules-to-json.ts — Generate <rule>.json shells from <rule>.md files in knowledge/rules/.
 *
 * Output shape matches what embed.ts / search.ts / page.ts expect for books:
 *   { id, title, author, domain, pages: [{ page: N, text: <one ## section> }] }
 *
 * Each H2 section becomes its own "page" so BM25 length-normalization doesn't
 * bury whole rule files, and semantic chunks align with rule sections.
 *
 * Re-runs automatically rewrite any shell whose .md is newer (mtime compare);
 * --force rewrites everything.
 *
 * Usage: bun rules-to-json.ts [--force]
 */

import { resolve, join, basename } from "node:path";
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";

const RULES_DIR = resolve(import.meta.dir, "..", "..", "knowledge", "rules");
if (Bun.argv.includes("-h") || Bun.argv.includes("--help")) {
  console.log("Usage: bun rules-to-json.ts [--force]\nRegenerates knowledge/rules/*.json search shells from *.md (mtime-aware; --force rewrites all).");
  process.exit(0);
}
const force = Bun.argv.includes("--force");

if (!existsSync(RULES_DIR)) {
  console.error(`Rules dir not found: ${RULES_DIR}`);
  process.exit(1);
}

const entries = readdirSync(RULES_DIR)
  .filter(f => f.endsWith(".md") && statSync(join(RULES_DIR, f)).isFile());

const summary: { id: string; bytes: number; written: boolean }[] = [];

for (const file of entries) {
  const id = basename(file, ".md");
  const mdPath = join(RULES_DIR, file);
  const jsonPath = join(RULES_DIR, `${id}.json`);

  if (!force && existsSync(jsonPath) && statSync(jsonPath).mtimeMs >= statSync(mdPath).mtimeMs) {
    summary.push({ id, bytes: 0, written: false });
    continue;
  }

  const text = readFileSync(mdPath, "utf-8");
  const firstLine = text.split("\n").find(l => l.startsWith("# "));
  const title = firstLine ? firstLine.replace(/^#\s+/, "").trim() : id;

  // Split on H2 headings; the preamble (before the first ##) is page 1.
  // Each page keeps its heading + the file title as context for retrieval.
  const lines = text.split("\n");
  const sections: { heading: string; body: string[] }[] = [{ heading: title, body: [] }];
  for (const line of lines) {
    if (/^##\s+/.test(line)) sections.push({ heading: line.replace(/^##\s+/, "").trim(), body: [line] });
    else sections[sections.length - 1].body.push(line);
  }
  const pages = sections
    .map((sec, i) => ({
      page: i + 1,
      text: (i === 0 ? sec.body.join("\n") : `# ${title}\n\n` + sec.body.join("\n")).trim()
    }))
    .filter(pg => pg.text.length >= 40);

  const shell = {
    id,
    title,
    author: "studio",
    domain: "rules",
    pages: pages.length > 0 ? pages : [{ page: 1, text }]
  };

  writeFileSync(jsonPath, JSON.stringify(shell, null, 2) + "\n");
  summary.push({ id, bytes: text.length, written: true });
}

console.log(JSON.stringify({ rules_dir: RULES_DIR, count: entries.length, summary }, null, 2));
