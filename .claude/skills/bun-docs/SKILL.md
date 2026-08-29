---
name: bun-docs
description: Search and fetch Bun's official documentation across docs, reference, guides, and blog. Use when the user asks about Bun APIs, the Bun runtime, bun:sqlite, Bun.file/Bun.write/Bun.serve, the bundler, test runner, package manager (bun install / bun add / bun pm), bun.com/reference signatures, bun.com/docs/guides recipes, or recent Bun release notes from the blog. Returns the matching doc sections (not just URLs) backed by a local cache at ~/.cache/bun-docs that survives offline.
argument-hint: "[query] or [--refresh]"
allowed-tools: Bash(bun ${CLAUDE_SKILL_DIR}/scripts/*.ts *)
license: MIT
compatibility: Requires Bun runtime (>=1.0) on PATH. Network access to https://bun.com on first run; afterwards reads from local cache at ~/.cache/bun-docs.
---

# Bun Docs

**Context:** $ARGUMENTS

## Quick start

- **User asks an open question about Bun:** → Step 1 (search), then answer using the returned section bodies.
- **User asks "what's new in Bun" or about a recent release:** → Step 1 with `--source blog`.
- **User asks for an exact signature / parameter list:** → Step 1 with `--source reference`.
- **First time on this machine, or cache is missing / stale:** → Step 0 (fetch + index), then Step 1.

## Step 0 — Prepare the cache (only if missing or stale)

Check whether `~/.cache/bun-docs/index.json` exists. If not, OR if the user said "refresh", run both scripts in order:

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts [--refresh] [--verbose]
bun ${CLAUDE_SKILL_DIR}/scripts/index.ts [--verbose]
```

`fetch.ts` downloads ~330 markdown pages (docs + reference + blog) into `~/.cache/bun-docs/raw/` and writes a manifest. Skipped on subsequent runs unless `--refresh` is passed or the per-page TTL (24h) has elapsed. Roughly 60–90 seconds on a fresh fetch.

`index.ts` builds a BM25 inverted index at `~/.cache/bun-docs/index.json` (~5MB). Always rebuilds from the current `raw/`.

Both scripts print a JSON summary to stdout. Surface any non-empty `errors` array to the user verbatim before proceeding to Step 1.

## Step 1 — Search

Run:

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "QUERY" [--limit N] [--source docs|reference|blog] [--min-score 0.2] [--markdown]
```

Default output is JSON with `hits[].body` containing the full section markdown — read it and answer the user directly. Do NOT just hand back URLs.

Pick `--source`:
- `docs` for conceptual / how-to questions (default; fits ~80% of cases)
- `reference` when the user pastes an API name or asks for exact signatures
- `blog` when the user asks "what's new" or about specific release notes

Use `--source` whenever the question is clearly scoped. Cross-subtree search produces noisier ranking on a corpus this small.

Default `--limit` is 5. Drop to 2–3 for narrow questions; raise to 10 only when the answer needs to triangulate across sections.

Use `--markdown` only if the user explicitly asks for a human-readable dump (e.g. "show me the file-io page").

## Step 2 — Answer the user

Read the `body` field of each hit. Compose the answer in your own words, citing the doc title + section header inline so the user can follow up. The result already includes the canonical `url`; mention it once at the end as a "see also" link.

If `total` is 0:
1. Try the same query with `--min-score 0` (already the default, but explicit).
2. Try paraphrasing — drop product-name tokens ("Bun", "bun") which are very high-frequency and have low IDF, and add domain-specific tokens.
3. If still empty, tell the user the local cache may be stale and offer to run `--refresh`.

## Resources

<!-- Every file below has an exact load/run condition. Do not load anything without one. -->

Scripts:
- `${CLAUDE_SKILL_DIR}/scripts/fetch.ts` — run when `~/.cache/bun-docs/manifest.json` is missing OR the user says "refresh" / "re-pull docs" / "update bun docs". Invocation: `bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts [--refresh] [--verbose] [--dry-run]`.
- `${CLAUDE_SKILL_DIR}/scripts/index.ts` — run immediately after `fetch.ts` whenever new pages were fetched, OR when `~/.cache/bun-docs/index.json` is missing. Invocation: `bun ${CLAUDE_SKILL_DIR}/scripts/index.ts [--verbose]`.
- `${CLAUDE_SKILL_DIR}/scripts/search.ts` — run on every user question that this skill handles. Invocation: `bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "QUERY" [--limit N] [--source docs|reference|blog] [--min-score N] [--markdown]`.

References (load only the file matching the current situation):
- `${CLAUDE_SKILL_DIR}/references/coverage-map.md` — load when the user's question is broad and you need to decide which `--source` value (or which sub-area within `docs`) is most likely to hold the answer.
- `${CLAUDE_SKILL_DIR}/references/sections-llms-txt.md` — load when extending or debugging `fetch.ts` (e.g. user reports a new page isn't being picked up).
- `${CLAUDE_SKILL_DIR}/references/cache-layout.md` — load when any script reports a cache error, OR when the user asks where data is stored or wants to manually intervene in the cache.

Assets:
- `${CLAUDE_SKILL_DIR}/assets/schema.json` — use as the JSON Schema source-of-truth when validating `manifest.json` or `index.json`, or when generating typed wrappers from a different runtime.

## Gotchas

- The skill caches at `~/.cache/bun-docs/`, not `~/.config/`. Cache is regenerable; never check it into version control.
- The blog is **not** indexed via `llms.txt` — it's scraped from the `https://bun.com/blog` HTML index. If a brand-new post is missing, `--refresh` will pick it up.
- BM25 scoring is normalised to `[0..1)` via `|raw| / (1 + |raw|)`. A score of `0.5` is roughly "this section probably mentions every query term"; below `0.2` is weak.
- Stopwords are pruned but the stoplist is small — terms like `fs`, `io`, `is`, `of` are kept because they're load-bearing in this corpus.
- `fetch.ts` prunes raw/*.md files that are no longer in the freshly-discovered URL set. Don't rely on raw/ for archival of removed pages.
- `index.json` is not atomically written. If a previous `index.ts` crashed, `search.ts` will fail loudly — just re-run `index.ts`.

## Examples

### Example 1: "How do I write a binary file with Bun?"

1. Cache check — `index.json` exists, skip Step 0.
2. `bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "write binary file Bun.write Uint8Array" --source docs --limit 3`
3. Top hit's `body` contains the canonical `Bun.write(path, uint8array)` example from `/docs/runtime/file-io`. Answer using that section, cite the URL.

### Example 2: "What changed in the bun bundler recently?"

1. `bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "bundler" --source blog --limit 3`
2. Read each hit body for date + summary. Compose a chronological summary, surfacing the URLs at the end.

### Example 3: "What's the exact signature of Bun.serve?"

1. `bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "Bun.serve" --source reference --limit 2`
2. Paste the relevant signature block from the top hit's `body` into the answer.

## Troubleshooting

### Error: `no manifest at /Users/.../.cache/bun-docs/manifest.json`

Cause: `fetch.ts` hasn't been run on this machine.
Solution: Run Step 0 in full.

### Error: `no index at /Users/.../.cache/bun-docs/index.json`

Cause: `fetch.ts` ran but `index.ts` didn't (or crashed mid-write).
Solution: Re-run `bun ${CLAUDE_SKILL_DIR}/scripts/index.ts`.

### `search.ts` returns 0 hits

Cause 1: Query terms are too rare or all stopwords.
Cause 2: Cache is stale and the relevant page was added recently.
Solution: Paraphrase the query, then if still empty offer to `--refresh`.

### `fetch.ts` reports network errors

Cause: Offline, or `bun.com` is unreachable.
Solution: The skill works offline against whatever's already cached. Tell the user current results may be stale and continue with the cached corpus.
