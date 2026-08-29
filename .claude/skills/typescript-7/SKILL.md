---
name: typescript-7
description: >
  TypeScript 7, typescript-go, tsgo — the native Go compiler port. Use when migrating TS 6 to TS 7, when a JSDoc tag, expando property, or CommonJS export that compiled under TS 6 now errors, or when asking whether a TS 7 component (language service, compiler API, build mode) is ready yet. Covers the TS 6 to 7 breaking-change list and the feature-parity table.
argument-hint: "[query] or [--refresh]"
allowed-tools: Bash(bun ${CLAUDE_SKILL_DIR}/scripts/*.ts *)
license: MIT
compatibility: Requires Bun on PATH. Network access to raw.githubusercontent.com on first run; afterwards reads the local cache at ~/.cache/typescript-7.
---

# TypeScript 7

**Context:** $ARGUMENTS

## Quick start

- **"Why did this .js/JSDoc/CommonJS pattern stop working in TS 7?"** → Step 1, `--source changes`
- **"Is <feature> ready in TS 7 yet?"** → Step 1, `--source readme`
- **"What changed between TS 6 and TS 7?"** → Step 1, then read the returned section bodies
- **Cache missing, or the user said "refresh"** → Step 0, then Step 1

## When to use

- Migrating a codebase from TypeScript 6.x to 7.x and hitting new errors
- A JSDoc tag, expando property, or CommonJS export pattern that compiled under TS 6 now errors
- Asking whether the language service, compiler API, build mode, or any other component is ready in TS 7
- Asking what `tsgo` is, or how the Go port relates to `tsc`

**Not for:** general TypeScript language questions (generics, utility types, `tsconfig` options that predate TS 7). Those are ordinary TypeScript knowledge — this corpus only covers the TS 6 → TS 7 delta and the port's readiness status.

## Step 0 — Prepare the cache (only if missing or stale)

Check whether `~/.cache/typescript-7/CHANGES.md` exists. If not, or the user asked to refresh:

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts [--refresh] [--verbose]
```

Downloads `README.md` and `CHANGES.md` from `microsoft/typescript-go@main` into `~/.cache/typescript-7/`. Re-downloads only past a 24h TTL unless `--refresh` is passed. Prints a JSON summary; surface any non-empty `errors` array to the user verbatim before continuing.

## Step 1 — Search

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "QUERY" [--limit N] [--source changes|readme]
bun ${CLAUDE_SKILL_DIR}/scripts/search.ts --list
```

Pick `--source`:
- `changes` — breaking changes, removed features, "why does this error now" (most questions)
- `readme` — readiness/parity status, preview install, what the port is
- omit — search both

Each hit returns `path` (full heading ancestry, e.g. `Component-Level Changes › Checker › Expandos › Constructor functions are no longer supported`) and `body` (the complete section markdown). Read `body` and answer from it — do not hand back a URL and stop.

Default `--limit` is 5; drop to 2 for a narrow question.

Exit code 1 with `total: 0` means no match. Before telling the user the answer isn't documented, run `--list` — the whole corpus is only ~40 sections, so scanning every heading is cheap and reliable.

## Step 2 — Answer

Quote the substitute/replacement code from the section body when the user is fixing broken code — every removed feature in `CHANGES.md` ships a "Substitute" column or a rewritten example. Cite the section `path` inline and the `url` once at the end.

## Resources

Scripts:
- `${CLAUDE_SKILL_DIR}/scripts/fetch.ts` — run at Step 0 when `~/.cache/typescript-7/CHANGES.md` is absent, or the user asks to refresh. Invocation: `bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts [--refresh] [--verbose]`
- `${CLAUDE_SKILL_DIR}/scripts/search.ts` — run at Step 1 for every question this skill handles. Invocation: `bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "QUERY" [--limit N] [--source changes|readme]` or `--list` to dump all section headings.

## Gotchas

- **`CHANGES.md` never says "TypeScript 6" or "TypeScript 7" — it says Strada and Corsa.** Strada = the old JavaScript-based compiler (TS 6.x); Corsa = the Go port (TS 7). A search for "TS 6 behaviour" misses text written as "Strada". Search the codenames when a plain-version query returns nothing.
- **The binary is `tsc`, not `tsgo`.** `tsgo` was the preview command shipped with `@typescript/native-preview`. From the 7.0 RC onward the command name is `tsc`. Never tell a user on a released 7.x to run `tsgo`.
- **`microsoft/typescript-go` is closed and gets archived September 2026.** Development moved back into `microsoft/TypeScript`, whose `main` is already the Go codebase. The raw URLs still resolve (archiving is read-only, not deletion), so `fetch.ts` keeps working — but if it ever 404s, `CHANGES.md` has moved into `microsoft/TypeScript` and the URLs in `fetch.ts` need updating.
- **`CHANGES.md` exists only in `typescript-go`.** `raw.githubusercontent.com/microsoft/TypeScript/main/CHANGES.md` is a 404 — do not "helpfully" redirect there.
- **Language service is `in progress` and the compiler API is `not ready`.** Anyone consuming the TypeScript compiler API programmatically is not ready to migrate, regardless of `tsc` working. Check the parity table before advising a migration.
- **Node positions are UTF-8 offsets now, not UTF-16.** Any tool computing positions against the AST in files with non-ASCII characters reads differently. This bites custom lint rules and codemods, not ordinary builds.
- **Declaration emit from `.js` inputs intentionally does not match TS 6 output.** A diff in generated `.d.ts` is expected, not a bug — unless the output is actually incorrect.

## Examples

### A JSDoc constructor function stopped compiling

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "constructor function prototype" --source changes --limit 2
```

Top hit: `Component-Level Changes › Checker › Expandos › Constructor functions are no longer supported`, whose body carries the `class` rewrite to hand the user.

### Checking whether the compiler API is usable

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/search.ts "API status" --source readme --limit 1
```

Returns the parity table; report the row verbatim rather than summarising a status.

## Troubleshooting

### `Error: cache missing (CHANGES.md, README.md)`

Cause: Step 0 was never run on this machine.
Solution: `bun ${CLAUDE_SKILL_DIR}/scripts/fetch.ts --verbose`, then retry the search.

### `fetch.ts` reports `HTTP 404`

Cause: the archived `typescript-go` repo was finally removed, or the file moved into `microsoft/TypeScript`.
Solution: check `https://github.com/microsoft/TypeScript` for `CHANGES.md` and update the `SOURCES` array in `fetch.ts`. Tell the user the source moved — do not fall back to answering from memory.

### Search returns `total: 0` for a question that should be covered

Cause: the query used version numbers where the doc uses codenames, or terms the doc phrases differently.
Solution: retry with `Strada`/`Corsa`, then run `--list` and pick the relevant section by heading.
