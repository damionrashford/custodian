# Coverage Map

<!--
Load when: the user's question doesn't clearly indicate which Bun subtree
holds the answer, OR when search.ts is about to be invoked with a `--source`
filter and the agent needs to pick the right one.
-->

## Overview

This file maps every subtree the `bun-docs` skill indexes to its purpose and
to the `--source` flag value `search.ts` accepts. Without this map the agent
tends to run `search.ts` with no `--source` and gets noisy cross-subtree
results.

## Sources indexed

| `--source` value | URL prefix                       | Indexed from               | What lives here                                                                                                                                                                                                                              |
| ---------------- | -------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs`           | `https://bun.com/docs/...`       | `/docs/llms.txt`           | Conceptual guides: runtime, file I/O, SQLite, HTTP server, networking, env vars, shell, spawn, package manager (`/docs/pm/...`), bundler (`/docs/bundler/...`), test runner (`/docs/test/...`), guides (`/docs/guides/...`).                  |
| `reference`      | `https://bun.com/reference/...`  | `/reference/llms.txt`      | Per-API technical reference: full TypeScript signatures, parameter tables, return types. The model should prefer `reference` when the user asks "what arguments does X take" or pastes a function name in isolation.                          |
| `blog`           | `https://bun.com/blog/...`       | HTML scrape of `/blog`     | Release notes, deep-dives, performance posts, Anthropic acquisition / Vercel native-Bun announcements. Useful when the user asks "what changed in Bun N" or "why does Bun do X".                                                              |

## Sub-areas within `docs`

The `docs` source is the largest. When the user's question is specific to one
of these, narrow the query terms rather than the `--source` (we don't shard
beyond top-level source in v0):

- **Runtime** — `/docs/runtime/...` — module resolution, transpiler, REPL,
  watch mode, plugins, file types, file I/O, streams, binary data, SQLite,
  S3, Redis, workers.
- **HTTP** — `/docs/api/http`, `/docs/api/websockets`, `/docs/api/tcp`,
  `/docs/api/udp`, `/docs/api/fetch`, `/docs/api/dns`.
- **Package manager** — `/docs/pm/cli/install`, `/docs/pm/cli/add`,
  `/docs/pm/cli/remove`, `/docs/pm/cli/update`, `/docs/pm/cli/run`,
  `/docs/pm/cli/x`, `/docs/pm/workspaces`, `/docs/pm/lockfile`.
- **Bundler** — `/docs/bundler/intro`, `/docs/bundler/loaders`,
  `/docs/bundler/plugins`, `/docs/bundler/macros`, `/docs/bundler/css`,
  `/docs/bundler/html`, `/docs/bundler/executables`.
- **Test runner** — `/docs/test/writing`, `/docs/test/coverage`,
  `/docs/test/mocks`, `/docs/test/snapshots`, `/docs/test/lifecycle`,
  `/docs/test/dom`, `/docs/test/runtime-behavior`.
- **Guides** — `/docs/guides/...` — recipe-style cookbook entries
  ("Send a file as an HTTP response", "Spawn a child process"...). Always
  retrieved alongside the underlying docs page, never instead of it.

## Gotchas

- The Bun **API namespace** (the `Bun` global: `Bun.serve`, `Bun.file`,
  `Bun.write`, `Bun.spawn`, `Bun.SQL`) lives under `/docs/api/...` AND has
  signature pages under `/reference/...`. For "how do I use it" → `docs`.
  For "exact signature" → `reference`.
- **`bun:sqlite`, `bun:ffi`, `bun:test`** are runtime built-ins. Their
  conceptual docs are under `/docs/api/sqlite`, `/docs/api/ffi`,
  `/docs/test/writing`. The TypeScript types appear in `reference`.
- The blog is **not** llms.txt-indexed; `fetch.ts` discovers blog posts by
  scraping `https://bun.com/blog` for `/blog/<slug>` anchors. If a brand-new
  post is missing, re-run `fetch.ts --refresh`.
- Older guides may reference deprecated APIs. Cross-check against the
  corresponding `/reference/...` page before suggesting code.
