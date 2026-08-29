---
name: keep-changelog
description: >
  Create, update, validate, and release CHANGELOG.md per Keep a Changelog 1.1.0. Use when the user mentions a changelog, CHANGELOG.md, release notes, cutting or tagging a release, an Unreleased section, or asks where to record a change.
allowed-tools: Bash(bun ${CLAUDE_SKILL_DIR}/scripts/*.ts *)
argument-hint: "[record | validate | release X.Y.Z]"
---

# Keep a Changelog 1.1.0

**Context:** $ARGUMENTS

Spec: <https://keepachangelog.com/en/1.1.0/>. Target file in this repo: `CHANGELOG.md` at the repo root.

## Quick start

- **Record a change that just shipped** → Step 2
- **Create a CHANGELOG.md that does not exist yet (or is empty)** → Step 1
- **Check an existing file for violations** → Step 3
- **Cut a release / tag a version** → Step 4
- **Decide which of the six types an entry belongs under** → load `references/writing-entries.md`
- **Answer "what does the spec actually say"** → load `references/spec-1-1-0.md`

## Step 1 — Create or repair the file

1. Read the target file first. An existing file's conventions win over the template where they do not violate the spec (e.g. keep their tag prefix, their repo URL host, their heading capitalisation).
2. If the file is missing or empty, copy `assets/changelog-template.md` to the target path and replace `OWNER/REPO` with the real repository. If there is no known repository URL, drop the `[unreleased]:` line rather than inventing one.
3. Run `validate.ts` (Step 3) and fix what it reports before adding content.

The required skeleton:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
```

## Step 2 — Add an entry

1. Decide whether the change is **notable** — would a reader of the public surface act differently because of it? Internal refactors, whitespace, CI config and test-only changes are not notable. Skipping something notable is the "Inconsistent Changes" antipattern.
2. Pick exactly one of the six types: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. No other heading is legal. Load `references/writing-entries.md` for the decision table and tie-breaks.
3. Put the entry under `## [Unreleased]`, in a `### <Type>` section, as a `- ` bullet. Create the `### <Type>` heading only if it does not already exist — never a second one of the same name.
4. Keep the sections in canonical order: Added → Changed → Deprecated → Removed → Fixed → Security.
5. Write the entry as a user-visible statement. Never paste a commit subject, sha, `feat:`/`fix:` prefix, or PR title.
6. Run `validate.ts`.

## Step 3 — Validate

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/validate.ts --file ./CHANGELOG.md --format text
```

Exit 0 = clean, 1 = errors, 3 = warnings only, 2 = usage error. Fix every `error`. Judge each `warning` — they are real spec guidance, but `non-dash-bullet` and `change-type-order` may be deliberately overridden by an existing file's house style.

Report findings to the user. Do not silently rewrite a file the user did not ask you to rewrite — quote the findings and propose the edit.

## Step 4 — Cut a release

```bash
# always preview first
bun ${CLAUDE_SKILL_DIR}/scripts/release.ts --file ./CHANGELOG.md --version 0.2.0 --dry-run --no-git
# then apply
bun ${CLAUDE_SKILL_DIR}/scripts/release.ts --file ./CHANGELOG.md --version 0.2.0
```

1. Confirm the version with the user. Derive the bump from the entry types present: any `Removed` or contract-breaking `Changed` → MAJOR; any `Added`/`Deprecated` → MINOR; only `Fixed`/`Security` → PATCH.
2. The date defaults to today. Override with `--date` only when the release actually happened on another day.
3. If the file has no existing version link references, pass `--repo-url https://host/owner/repo` or the script exits 3 with the link references skipped.
4. Re-run `validate.ts` on the result.

## Resources

Scripts:
- `${CLAUDE_SKILL_DIR}/scripts/validate.ts` — run after every edit to a changelog, and before reporting a changelog as correct. Parses the file and reports spec violations as JSON (or `--format text`). Read-only. Invocation: `bun ${CLAUDE_SKILL_DIR}/scripts/validate.ts --file ./CHANGELOG.md [--format text] [--strict] [--list-rules] [--verbose]`
- `${CLAUDE_SKILL_DIR}/scripts/release.ts` — run when the user asks to cut, tag, or publish a release, or to move `[Unreleased]` into a version. Moves entries, dates the new section, rewrites link references. Invocation: `bun ${CLAUDE_SKILL_DIR}/scripts/release.ts --version X.Y.Z --file ./CHANGELOG.md [--date YYYY-MM-DD] [--repo-url URL] [--tag-prefix v] [--yanked] [--allow-empty] [--force] [--no-git] [--dry-run] [--verbose]`

Both scripts print full usage, flags, and exit codes with `--help`. Run `--help` rather than guessing a flag.

References (load only the file matching the current task):
- `${CLAUDE_SKILL_DIR}/references/spec-1-1-0.md` — load when the user questions or disputes a rule, asks what the spec says, asks about yanked releases, link-reference format, GitHub Releases vs a file, or when auditing an unfamiliar changelog against the full spec.
- `${CLAUDE_SKILL_DIR}/references/writing-entries.md` — load when writing or reclassifying entries: which of the six types applies, how to word an entry, breaking-change wording, deprecation lifecycle, which SemVer bump the entries imply.

Assets:
- `${CLAUDE_SKILL_DIR}/assets/changelog-template.md` — copy as the starting file in Step 1 when `CHANGELOG.md` is missing or empty. It validates clean as-is once `OWNER/REPO` is replaced.

## Gotchas

- **This repo is not a git repository.** `git status`, `git log`, and `git tag` all fail in `prod-agent`. Never derive entries from git history here, and never assume `release.ts` can infer a repository URL — pass `--repo-url` or accept exit code 3 (link references skipped). `--no-git` makes the skip deterministic.
- **`/Users/damionrashford/Projects/prod-agent/CHANGELOG.md` is currently empty** (0 bytes). It has no header, no `[Unreleased]`, and no link references. Step 1 applies before anything else.
- **The date is the release date, not the authoring date.** Writing today's date on a section you are drafting for a release that ships next week makes the file lie. `validate.ts` flags future dates but cannot catch a past date that was simply wrong.
- **The `[unreleased]` link reference must be updated on every release** or it silently points at the wrong diff — it stays syntactically valid while comparing an old tag to HEAD, so nothing breaks visibly. `release.ts` rewrites it; a hand-edited release almost always forgets it.
- **Security fixes go under `Security`, never `Fixed`.** Readers scan `Security` to decide whether an upgrade is urgent. A CVE buried in `Fixed` is invisible.
- **`Removed` with no prior `Deprecated` is an upgrade trap.** The spec's single strongest demand: users must be able to upgrade to a version that lists the deprecation, remove what is deprecated, then upgrade to the removal.
- **Only six `###` headings exist.** `Improvements`, `Performance`, `Breaking`, `Docs`, `Chore`, `Misc` are all violations, however reasonable they look.
- **Delete empty `###` sections.** An `### Added` with no bullets is noise, not a placeholder. Absence means "nothing notable", by convention.
- **`[Unreleased]` carries no date.** Released versions always do.
- **Version headings use the bare version, tags keep the `v`.** `## [1.2.0]`, but `[1.2.0]: .../compare/v1.1.0...v1.2.0`. `release.ts` infers the tag prefix from existing link references; `--tag-prefix ""` for projects that tag without one.
- **The oldest version links to a release tag, not a compare range** — there is no predecessor to diff against.
- **Markdown link references are case-insensitive**, so a `## [Unreleased]` heading resolves against a `[unreleased]:` definition. Both scripts match case-insensitively; do not "fix" the case mismatch.
- **The skill directory must never contain `package.json`, `node_modules`, or a lockfile** — that breaks Bun's inline auto-install. There is also no per-skill `tsconfig.json`; typing comes from `/Users/damionrashford/Projects/prod-agent/.claude/skills/tsconfig.json`.

## Examples

### Example 1: record a fix that just shipped

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/validate.ts --file ./CHANGELOG.md --format text
```

Edit `## [Unreleased]` → `### Fixed` → add `- Fixed the fallback chain crossing an EU residency boundary when no in-region provider was eligible.` Re-run validate; expect exit 0.

### Example 2: cut 0.2.0 on a repo with existing link references

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/release.ts --file ./CHANGELOG.md --version 0.2.0 --dry-run --no-git
```

The JSON `content` field holds the exact resulting file. Show the user the new section and the two rewritten link references, then re-run without `--dry-run`.

### Example 3: audit an unfamiliar changelog

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/validate.ts --file ./vendor/CHANGELOG.md --format text
bun ${CLAUDE_SKILL_DIR}/scripts/validate.ts --list-rules
```

Group the findings by rule, report errors first, and propose edits — do not apply them unless asked.

## Troubleshooting

### `Error: [Unreleased] has no entries in <file>` (exit 1)

Cause: `release.ts` found the `## [Unreleased]` heading but no `- ` bullets under it.
Solution: add the entries first (Step 2). Only use `--allow-empty` for a deliberate empty release, which is almost never right.

### `Warning: no compare-URL base found` / exit 3

Cause: the file has no existing version link reference, no `--repo-url` was passed, and there is no git remote (this repo is not a git repository).
Solution: re-run with `--repo-url https://github.com/OWNER/REPO`, or accept the release and add the two link references by hand.

### `Error: version X is not greater than the latest release Y` (exit 1)

Cause: the requested version sorts at or below the newest section, which would break latest-first ordering.
Solution: pick a higher version. Use `--force` only when back-filling a historical release, and re-run `validate.ts` afterwards — ordering will need a manual fix.

### `error: [unlinked-version-heading]`

Cause: a heading like `## 2.0.0 - 2026-01-01` without brackets.
Solution: `## [2.0.0] - 2026-01-01` plus a matching `[2.0.0]: <url>` definition at the bottom. Versions and sections must be linkable.
