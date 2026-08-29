# Cache layout — `~/.cache/bun-docs/`

<!--
Load when: a script reports a cache-related error, OR the user asks "where
does this skill store data", OR you need to manually delete part of the
cache to force a re-fetch / re-index.
-->

## Overview

Everything the skill writes lives under `~/.cache/bun-docs/`. The location
follows XDG conventions: this is *regenerable* data, so it belongs in
`~/.cache/`, not `~/.config/` (which is for hand-curated state).

The agent should never write here directly — only `fetch.ts` and `index.ts`
do.

## Layout

```
~/.cache/bun-docs/
├── manifest.json                     # URL → cached-file mapping (written by fetch.ts)
├── index.json                        # BM25 inverted index (written by index.ts)
└── raw/                              # One markdown file per fetched page
    ├── docs/
    │   ├── index.md
    │   ├── installation.md
    │   ├── quickstart.md
    │   ├── runtime/
    │   │   ├── file-io.md
    │   │   ├── sqlite.md
    │   │   └── ...
    │   ├── api/
    │   ├── pm/
    │   ├── bundler/
    │   ├── test/
    │   └── guides/
    ├── reference/
    │   └── ...
    └── blog/
        ├── bun-joins-anthropic.md
        ├── bun-bundler.md
        └── ...
```

## File contracts

### `manifest.json`

Schema: see `assets/schema.json`. Maps each canonical URL (without trailing
`.md`) to:

```json
{
  "url": "https://bun.com/docs/runtime/file-io",
  "source": "docs",
  "file": "raw/docs/runtime/file-io.md",
  "bytes": 8412,
  "fetchedAt": "2026-05-16T03:21:09.183Z",
  "contentType": "text/markdown; charset=utf-8"
}
```

`fetch.ts` uses `fetchedAt` to decide whether a page is stale (default TTL
24h, overridable by `--refresh`).

### `index.json`

A single JSON object with the BM25 index:

- `chunks: Chunk[]` — one row per `## ` section, with full body inlined so
  `search.ts` can return the section text without a second disk hit.
- `postings: Record<term, [chunkIndex, tf][]>` — the inverted index.
- `df: Record<term, number>` — document frequency per term for IDF.
- `k1`, `b`, `avgdl`, `n` — BM25 hyperparameters and corpus stats.

The whole index is small enough to JSON.parse on every `search.ts`
invocation (~5MB on a ~330-page corpus, sub-100ms parse). If it grows much
larger, switch to a `bun:sqlite` FTS5 backend (cache.sqlite next to index.json).

## Common operations

```bash
# How much disk does the cache use?
du -sh ~/.cache/bun-docs

# Force re-fetch every page (e.g. after a major Bun release).
bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts --refresh && \
  bun ${CLAUDE_SKILL_DIR}/scripts/index.ts

# Nuke the cache to start fresh.
rm -rf ~/.cache/bun-docs

# Inspect a single cached page.
cat ~/.cache/bun-docs/raw/docs/runtime/file-io.md
```

## Gotchas

- `fetch.ts` prunes raw/*.md files that are no longer present in the
  freshly-discovered URL set. If a page is renamed upstream, the old cached
  copy is deleted on the next fetch — don't rely on raw/ for archival.
- `index.json` is **not** atomic-written. If the indexer crashes mid-write,
  the file is corrupt and `search.ts` will fail loudly. Re-run `index.ts`
  to repair.
- The chunk `id` is `sha256(url + '#' + section)[0..7]`. URL changes or
  section heading renames produce new IDs — cited docids from a prior
  search may not resolve after an upstream restructure.
