# Project-specific playwright-cli notes

Findings from actually exercising the vendored skill in this repo — kept separate from
`.claude/skills/playwright-cli/` since that's a verbatim copy of Microsoft's official skill and
shouldn't be edited.

## `attach` + `resume` on a multi-test file can collide

Attaching to a `--debug=cli` session paused on a spec file with more than one `test(...)`, then
calling `resume`, let the first test finish — but the run then failed the *second* test with
`Error: browser.bind: Server is already started.` The attached CLI session appears to hold the
browser server exclusively; once the first test completes and the worker tries to start the next
test's browser, it collides with the CLI's own handle on it.

Workaround: point `--debug=cli` at a single test (`playwright test file.spec.ts:<line> --debug=cli`,
per `references/playwright-tests.md`'s own debugging-a-single-failure pattern) rather than a whole
file, when you intend to `attach`/`resume` interactively. This is also what the official
`test-generation.md` plan/generate/heal workflow already does — one scenario at a time — so following
that workflow as documented avoids the collision; it only showed up here because verification ran
against a two-test file directly.

## Config file location

`.playwright/cli.config.json` (checked into git) configures the CLI itself — `browserName: chromium`,
`codegen: typescript` (keeps generated-code output on, since the plan/generate/heal workflow depends
on it), `outputDir: ".playwright/output"` (redirects the CLI's own snapshot/screenshot output here
instead of its default `.playwright-cli/`, so everything playwright-cli-related lives under one
`.playwright/` folder: `cli.config.json`, `output/` — scratch, gitignored — and this `specs/`
subfolder — checked in).

This is unrelated to `playwright.config.ts` at the repo root, which configures the test *runner*
(`@playwright/test` — projects, retries, reporters). Different tool, different schema (JSON vs a
TypeScript `defineConfig` module) — the CLI's `--config` can't point at it.

## `outputDir` only applies to auto-generated filenames, not explicit ones

`outputDir` in `cli.config.json` routes commands that omit `--filename` (e.g. bare `snapshot`,
`screenshot`) to timestamped files under `.playwright/output/`. Confirmed for: snapshots,
screenshots, PDFs, tracing (auto-nests under `output/traces/`), video, storage-state.

**But** an explicit `--filename=<path>` (or positional filename, e.g. `state-save <path>`) is
resolved **relative to the current working directory, ignoring `outputDir` entirely** —
`screenshot --filename=screenshots/test.png` tried to write to `<repo-root>/screenshots/test.png`,
not `.playwright/output/screenshots/test.png`. To land an explicit-named file under the output tree,
prefix the path yourself: `--filename=.playwright/output/screenshots/test.png`.

It also does **not** create missing parent directories — errors `ENOENT` if the folder doesn't
exist. Per-type subfolders (`output/screenshots/`, `output/snapshots/`, `output/pdfs/`,
`output/videos/`, `output/storage-state/`) are pre-created in this repo for exactly this reason;
`output/traces/` is the one exception — `tracing-start` creates it itself.
