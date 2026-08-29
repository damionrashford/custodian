---
name: testing
description: >
  Use for anything touching prod-agent's test suite — writing a new test, running tests, a failing
  test, understanding tests/fixtures.ts or tests/seed.spec.ts, or where test artifacts land. Scoped
  to the tests/ folder and its two config files (playwright.config.ts, .playwright/cli.config.json).
  Triggers on: "add a test", "write a test for X", "run the tests", "why did this test fail",
  editing a `.spec.ts` file, tests/ folder changes.
argument-hint: "[what you're doing with tests]"
allowed-tools: Bash(bun run test*) Bash(bunx playwright *)
paths: ["tests/**", "playwright.config.ts", ".playwright/**"]
---

# Testing

**Context:** $ARGUMENTS

prod-agent's tests run on Playwright (`@playwright/test`). This skill covers how *this project*
organizes and runs them — for Playwright API/CLI syntax itself, that's general knowledge; for the
interactive `playwright-cli` tool specifically, see the sibling `playwright-cli` skill.

## Layout

| Path | Purpose |
|---|---|
| `tests/*.spec.ts` | Test files. Only `example.spec.ts` exists today (smoke test against real playwright.dev — proves the harness works, since prod-agent has no app of its own yet). |
| `tests/fixtures.ts` | Extends `test` with a `page` fixture that auto-navigates to `baseURL` on setup. Import `{ test, expect }` from here instead of `@playwright/test` once a real app exists. |
| `tests/seed.spec.ts` | Entry point for the `playwright-cli` plan → generate → heal workflow — see below. |
| `tests/results/` | Test-runner output (screenshots/videos/traces on failure). Gitignored. |
| `playwright.config.ts` | Test-runner config: projects (chromium/firefox/webkit), retries, reporters, `outputDir`. |
| `.playwright/cli.config.json` | Separate config for the *interactive* CLI tool — different schema, different purpose. Don't confuse the two. |

## Running tests

```bash
bun run test              # headless, all browsers
bun run test:headed       # visible browser
bun run test:ui           # interactive UI mode — best for authoring/debugging
bun run test:debug        # Playwright Inspector
bun run test:cli-debug    # pauses at test start, prints a session name for `playwright-cli attach`
bun run report            # open the last HTML report (CI only — local reporter is 'list')
bunx playwright test path/to/file.spec.ts -g "test name"   # one test
bunx playwright test --project=chromium                     # one browser
```

## Adding a new test — two paths

**Manual authoring** (you already know what to test): write `tests/<name>.spec.ts`, import from
`./fixtures` if it needs `baseURL` navigation, run `bun run test`. Standard Playwright — no special
process here.

**Exploration-driven** (you need to poke at a real page first, or want the plan → generate → heal
workflow): use the `playwright-cli` skill. It attaches to `tests/seed.spec.ts` paused via
`--debug=cli`, lets you explore interactively, and every action prints the Playwright code to paste
into the new test. Plan files live at `.playwright/specs/<feature>.plan.md` (see
`.playwright/specs/README.md` for the format) — check `.playwright/specs/NOTES.md` first for two
real gotchas already hit in this repo: `attach`+`resume` colliding on multi-test files, and
`--filename=` being CWD-relative rather than `outputDir`-relative.

## Current state — read before assuming `tests/seed.spec.ts` works out of the box

prod-agent has no implemented app yet (`CLAUDE.md`: research/planning phase). Consequences:

- `playwright.config.ts`'s `baseURL` is a placeholder (`http://localhost:3000`) with nothing
  listening on it.
- `tests/seed.spec.ts` is excluded from the default run via `testIgnore: '**/seed.spec.ts'` in
  `playwright.config.ts` — it would otherwise fail with `ERR_CONNECTION_REFUSED` on every run. It
  still works when invoked explicitly: `bunx playwright test tests/seed.spec.ts --debug=cli`.
- A commented-out `webServer` block sits in `playwright.config.ts` as a template. Once Phase 1 ships
  a dev server: fill in the real `command`, delete the `testIgnore` line, and `tests/seed.spec.ts`
  starts navigating for real with no other changes needed.

Don't "fix" the seed test's connection failure by changing `baseURL` to something that happens to
resolve (e.g. an external site) — that would defeat its purpose as the local-app entry point.
