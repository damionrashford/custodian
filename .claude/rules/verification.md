---
paths:
  - "tests/**/*.ts"
  - "scripts/**/*.ts"
  - ".github/workflows/*.yml"
  - ".dependency-cruiser.cjs"
  - "eslint.config.js"
  - "knip.json"
---

# Verification

How this repository decides that something is true. Everything here exists because a gate that
looked correct enforced nothing, and nobody noticed until something downstream broke.

## A gate is not enforcing until you have watched it fail

Writing a check is half the work. Before it is trusted, break the property it guards and confirm the
check fails — **and that it is the only one that fails.** A test that goes red for the wrong reason
is not evidence about the property it names.

This is not ceremony. `Test_and_Security_Assurance.txt:86` makes the same point about red teams: a
report with zero findings means the test was too weak.

## Plant the idiomatic violation, not the convenient one

If the codebase writes `import type`, the plant is an `import type`. Proving a layering rule with a
value import proved nothing about the 141 of 201 dependencies that were type-only and invisible to
the gate — three real violations were sitting in `main` the whole time (LD-11).

**Three ways a gate silently enforced nothing here, all found by planting:**

| The gate | Why it was vacuous |
|---|---|
| A `run:` block scanned with `/run: \|[\s\S]*?(?=…\|$)/m` | Under `m`, `$` matches at the end of *every* line, so the lazy quantifier stopped immediately and the check inspected the string `"run: \|"` |
| The same check, rewritten to walk indentation | `Bun.Glob.scan` skips dot-directories by default, so it never entered `.github/` and had nothing to read |
| A guard that skips where a tool is not installed | Scanning a non-existent directory *rejects* rather than yielding nothing, so the skip path threw — and the skip path had never been exercised |

All three passed review. All three passed a planted violation. Read that list before trusting a new
check.

## A plant pass starts from a clean tree

Run `bun scripts/plant-guard.ts` first. Restoring a plant with `git checkout <file>` reverts that
file to HEAD, taking any *other* uncommitted work in it — and nothing fails, because reverting to a
green HEAD leaves a green tree. Work was lost this way twice; once it was found only because someone
later ran the server by hand and saw it boot when it should have refused (LD-12).

With a clean tree, `git checkout` can only undo the plant, because the plant is the only change. A
`PreToolUse` hook refuses the command outright when the tree is dirty.

## A flaky gate is worse than a missing one

A gate that never fires is false assurance. A gate that fires at random trains people to click
through red CI, which costs the credibility of every gate beside it. **Neither belongs in a blocking
position** (LD-10).

Concretely: anything that reaches the network — pulling a base image, driving a container, fetching
a page — goes in a job that is *not* a required check, and the property it proves gets a text-level
check that blocks instead. The `sandbox` and `docker` jobs are both non-required for this reason,
and `tests/docker.test.ts` is the blocking half that reads the Dockerfile without a daemon.

## Process failures become tests, not reminders

When something goes wrong in a way that was invisible in the artefact — green tests, clean diff,
missing work — a reminder cannot fix it, because the person holding the reminder is the one who just
made the mistake. Write the guard instead, in `tests/standards.test.ts` where the repository's
configuration invariants live.

Guards that exist because of a specific incident: CI running on every pull request rather than only
those targeting `main`; no test reaching the network; the Dependabot ignore living in the right
ecosystem; every durable store classified in the erasure data map; every `@custodian/*` import
declared in its own manifest; no workflow splicing an expression into a shell script.

## Before claiming anything passed

Run it. `superpowers:verification-before-completion` exists for this, and the distinction it draws
is the one that matters: *"the diff is written"* and *"every consumer of this compiles, passes, and
no longer references the old path"* are different claims, and only the second one is done.

A command exiting 0 is not the same as the thing working. A build that succeeds and an image that
cannot start are different claims. Assert the second.
