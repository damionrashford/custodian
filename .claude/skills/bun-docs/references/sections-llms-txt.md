# `llms.txt` indices — format reference

<!--
Load when: extending fetch.ts (need to understand what URLs llms.txt yields),
OR debugging why a page wasn't picked up by fetch (e.g. user reports
"the new bun:redis page is missing").
-->

## Overview

Bun's documentation site is built on Mintlify, which exposes a machine-readable
index of every page at `https://<host>/<subtree>/llms.txt`. `fetch.ts` reads
this file instead of crawling so we avoid HTML parsing and rate limits.

This skill consumes two such indices:

- `https://bun.com/docs/llms.txt` — every `/docs/...` page
- `https://bun.com/reference/llms.txt` — every `/reference/...` page

The blog (`/blog/...`) does **not** have an `llms.txt` and is discovered by
scraping `/blog`'s HTML for `<a href="/blog/<slug>">` anchors.

## Format

Each `llms.txt` is plain markdown with a header section + a flat list of
links, one per line:

```
# Bun Documentation

> Bun is a fast all-in-one JavaScript runtime, bundler, test runner, and package manager.

## Docs

- [Welcome to Bun](https://bun.com/docs/index.md): The Bun runtime overview.
- [Installation](https://bun.com/docs/installation.md): How to install Bun on macOS, Linux, Windows.
- [Quickstart](https://bun.com/docs/quickstart.md): Run your first Bun program in 30 seconds.
- ...
```

The link pattern `fetch.ts` matches is `\((https?://[^\s)]+)\)` — it captures
the URL between parentheses, strips a trailing `.md` if present, and stores
the canonical (non-`.md`) URL. Every entry includes a one-line description
after the colon, which we ignore (we'll re-derive it from the page's
frontmatter when indexing).

## How Mintlify serves the `.md` siblings

For every page at `https://bun.com/<path>`, Mintlify also serves the raw
markdown body at `https://bun.com/<path>.md`. Example:

- `https://bun.com/docs/runtime/file-io` → human-rendered HTML
- `https://bun.com/docs/runtime/file-io.md` → raw markdown body

`fetch.ts` always fetches the `.md` variant. The body is markdown with no
HTML wrapper, no navigation chrome, and Mintlify-specific frontmatter
stripped — perfect for the BM25 indexer.

## What's NOT in `llms.txt`

- The blog (`/blog/...`) — not present in any llms.txt; scraped from the
  blog index HTML.
- Per-PR preview pages, marketing pages (`/install`, `/why`, etc.) — even
  though they may be on bun.com, the llms.txt files exclude them.
- The Wisp guide, the changelog page (if separate from `/blog`), the
  community page. If you want to index those, hardcode their URLs in
  `SOURCES` in `fetch.ts`.

## Gotchas

- llms.txt may list links **with** a trailing `.md` — `fetch.ts` strips it
  before caching so URLs are canonical.
- A page can appear in both `docs/llms.txt` AND `reference/llms.txt` under
  different paths (e.g. `bun:sqlite` has both a conceptual doc and a
  reference page). They're indexed as separate chunks because the bodies
  differ; both will appear in search results, but the `--source` filter
  lets the agent pick one.
- The blog scrape only finds posts linked from the index's first page. If
  Bun ever paginates the blog, update `discoverBlogPosts` to follow the
  pagination links.
- Mintlify occasionally returns a 304 with no body when the upstream is
  unchanged. `fetch.ts` treats any non-200 as an error and skips — fine for
  v0 because the manifest's TTL check already short-circuits the fetch for
  recently-cached pages.
