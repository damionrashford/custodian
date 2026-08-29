---
name: react-router
description: Search the complete React Router documentation and API reference. Use when configuring routes, route modules, loaders, actions, forms, fetchers, navigation, pending UI, middleware, sessions, SSR/SPA/pre-rendering, RSC, URL and search params, or upgrading React Router — and when looking up any hook, component, or exported type.
argument-hint: "[query] or [--refresh]"
allowed-tools: Bash(bun ${CLAUDE_SKILL_DIR}/scripts/*.ts *)
license: MIT
compatibility: Requires Bun on PATH. Network access to raw.githubusercontent.com and api.reactrouter.com on first run; afterwards reads the local cache at ~/.cache/react-router-docs.
---

# React Router

React Router is mode-specific. Identify the mode first, then search the docs — a Framework-mode answer applied to a Declarative app is wrong even when the API exists in both.

## Quick start

- **"How do I do X?"** → Step 1 (identify mode), Step 2 (`search.ts` with `--mode`)
- **"What are the arguments/type of `<symbol>`?"** → Step 3 (`api.ts`)
- **Need a whole page** → `search.ts --file <slug>`
- **Cache missing, or the user wants current docs** → Step 0

## Step 0 — Prepare the cache (only if missing or stale)

Check whether `~/.cache/react-router-docs/manifest.json` exists. If not, or the user asked to refresh:

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts [--refresh] [--verbose]
```

Caches all ~202 documentation markdown files from `remix-run/react-router@main/docs/` plus the ~898-symbol TypeDoc index. Takes about 4 seconds. Re-fetches only past a 7-day TTL unless `--refresh` is passed. Surface any non-empty `errors` array verbatim before continuing.

## Step 1 — Identify the mode

Do not apply Framework/Data patterns to a Declarative app unless the user is intentionally migrating modes.

### Framework Mode

- `@react-router/dev` in dependencies
- `react-router.config.ts`, `app/routes.ts`
- `app/entry.server.tsx` / `app/entry.client.tsx`
- route modules under `app/routes/`, exporting `loader`, `action`, `clientLoader`, `clientAction`, `ErrorBoundary`, `meta`, `links`, `headers`
- imports from `./+types/...`
- the Vite plugin from `@react-router/dev/vite`

Framework examples assume the default `app/` directory — check `react-router.config.ts` for a custom `appDirectory` before assuming paths. Then read `references/framework-mode.md`.

### Data Mode

- `createBrowserRouter`, `createHashRouter`, `createMemoryRouter`, `createStaticRouter`
- `<RouterProvider router={router}>`
- route objects with `path`, `children`, `loader`, `action`, `Component`, `ErrorBoundary`, `lazy`
- data APIs without the Framework Vite plugin

Then read `references/data-mode.md`.

### Declarative Mode

- `<BrowserRouter>`, `<HashRouter>`, `<MemoryRouter>`
- `<Routes>` / `<Route>` JSX configuration, components passed as `element={<Component />}`
- no data router, no route modules, no loaders/actions

Then read `references/declarative-mode.md`.

### RSC Framework and RSC Data Modes

React Server Components support is unstable and exists in both Framework and Data variants:

- `unstable_reactRouterRSC`, `@vitejs/plugin-rsc`, `unstable_RSCRouteConfig`
- RSC entry files such as `entry.rsc`
- `ServerComponent`, `ServerErrorBoundary`, `ServerLayout`, `ServerHydrateFallback`
- `"use client"`, `"server-only"`, `"client-only"`

For RSC Framework read `references/framework-mode.md` + `references/rsc.md`; for RSC Data read `references/data-mode.md` + `references/rsc.md`.

## Step 2 — Search the docs

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "QUERY" [--mode framework|data|declarative|rsc] [--section AREA] [--limit N] [--max-body N]
bun ${CLAUDE_SKILL_DIR}/scripts/search.ts --file <slug>
bun ${CLAUDE_SKILL_DIR}/scripts/search.ts --list [--section api]
```

Always pass `--mode` once the mode is known — it drops docs whose `[MODES: …]` marker excludes the app, which is the single biggest source of wrong React Router answers.

`--section` narrows by area: `api` (110 docs), `how-to` (30), `start` (28), `explanation` (20), `upgrading` (5), `tutorials` (4), `community` (3).

Each hit returns `slug`, `path` (heading breadcrumb), `modes`, `url`, and `body`. Bodies are truncated at 4000 chars with `truncated: true` — when that happens and the detail matters, re-read the whole page with `--file <slug>`.

Exit code 1 with `total: 0` means no match: drop `--mode`/`--section` and retry, or run `--list` to see the real slugs.

## Step 3 — Look up a symbol

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/api.ts NAME [--exact] [--kind Function|Interface|TypeAlias|Property|Variable] [--package PKG] [--limit N]
```

Use this when the question is "does this exist", "what package is it in", or "what's the exact type name" — it indexes the complete export surface including the `unstable_` and `UNSAFE_` exports and every interface property, which the prose docs never enumerate. It returns the canonical `api.reactrouter.com` URL per symbol, not prose; pair it with Step 2 for usage.

## Step 4 — Answer

Cite the doc `path` and `url` from the hit. When the user is writing code, quote the example from the section body rather than reconstructing it — the docs are generated from source JSDoc and track the current release.

## Resources

Scripts:
- `${CLAUDE_SKILL_DIR}/scripts/fetch.ts` — run at Step 0 when `~/.cache/react-router-docs/manifest.json` is absent or the user asks to refresh. `bun …/fetch.ts [--refresh] [--ref main] [--verbose]`
- `${CLAUDE_SKILL_DIR}/scripts/search.ts` — run for every "how do I / what does this doc say" question. `bun …/search.ts "QUERY" [--mode M] [--section A] [--file SLUG] [--list]`
- `${CLAUDE_SKILL_DIR}/scripts/api.ts` — run when the question names a specific hook, component, type, or export. `bun …/api.ts NAME [--exact] [--kind K] [--package P]`

References (load after identifying the mode in Step 1):
- `${CLAUDE_SKILL_DIR}/references/framework-mode.md` — Framework Mode, or the base layer of RSC Framework
- `${CLAUDE_SKILL_DIR}/references/data-mode.md` — Data Mode, or the base layer of RSC Data
- `${CLAUDE_SKILL_DIR}/references/declarative-mode.md` — Declarative Mode
- `${CLAUDE_SKILL_DIR}/references/rsc.md` — any unstable RSC app, loaded in addition to the mode reference

## Mode migration index

When the user asks to switch modes, read the target mode reference plus these pages via `search.ts --file <slug>`:

| Migration | Slugs to read |
|---|---|
| Declarative → Data | `start/modes`, `start/data/routing`, `start/data/data-loading`, `start/data/actions` |
| Declarative/Data → Framework | `start/modes`, `start/framework/routing`, `start/framework/route-module`, `how-to/route-module-type-safety` |
| Framework SPA/SSR/pre-render | `start/framework/rendering`, `how-to/spa`, `how-to/pre-rendering`, `start/framework/data-loading`, `start/framework/actions` |
| Future flags / version upgrades | `upgrading/future`, `upgrading/v7`, plus the rest of `--section upgrading` |

## Gotchas

- **Mode markers decide correctness, not the API's existence.** `useLoaderData` exists in Framework and Data mode but not Declarative. Docs without a `[MODES: …]` marker (tutorials, explanations) apply everywhere — the search treats them as mode-agnostic rather than excluding them.
- **The cache tracks `main`, which is the next release, not necessarily the installed version.** Before giving version-sensitive advice, check the project's installed `react-router` version. For an older major, re-fetch with `--ref` at that release tag (e.g. `--ref v7.18.3`) or point the user at the versioned site (`reactrouter.com/7.18.3`).
- **The old `node_modules/react-router/docs/` path is not a reliable source.** It only exists if the installed package ships docs, and it does not exist in a repo with no dependencies installed. Use the cache.
- **`api.reactrouter.com` is v8 and the docs site's version selector is separate.** A symbol URL from `api.ts` always points at v8; it can 404 or describe a different signature for a v6/v7 project.
- **Many API docs are generated from source JSDoc** and say so in an HTML comment at the top. That comment names the source file — useful when the doc is thin and the actual implementation answers the question.
- **`Form` vs `fetcher.Form` is the most commonly confused pair.** `explanation/form-vs-fetcher` exists specifically for this; read it before advising on either.
- **`unstable_` and `UNSAFE_` prefixes are load-bearing.** `api.ts` surfaces them; never recommend one without flagging that it is unstable or internal.

## Troubleshooting

### `Error: docs cache missing` / `symbol index missing`

Cause: Step 0 never ran on this machine.
Solution: `bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts --verbose`, then retry.

### `fetch.ts` fails listing the repo tree

Cause: unauthenticated GitHub API rate limit (60/hr per IP), or the `docs/` folder moved.
Solution: the error prints the HTTP status. On 403, wait or set `GITHUB_TOKEN` and retry. On an empty-tree error, check `https://github.com/remix-run/react-router` for the docs location and update the filter in `fetch.ts`.

### Search returns docs for the wrong mode

Cause: `--mode` was omitted.
Solution: re-run with `--mode`, and confirm the mode against Step 1 rather than assuming from the import path.
