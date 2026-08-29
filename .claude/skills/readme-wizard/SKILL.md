---
name: readme-wizard
description: >-
  Write or improve a README — from scratch or polishing an existing one. Use when the user mentions the README, shields.io badges, a project structure tree, docs table, contributor avatars, a mermaid diagram, the repo's first impression, or making the project "look professional". Not for CHANGELOG, CONTRIBUTING, API docs, or CI setup.
allowed-tools: Bash(bun ${CLAUDE_SKILL_DIR}/scripts/*.ts *)
---

# README Wizard

Generate or improve a project's README by scanning the repo and producing a polished result built from real project data. Ported from [debs-obrien/learn-agent-skills](https://github.com/debs-obrien/learn-agent-skills), adapted for this repo.

## This repo

The default target is `/Users/damionrashford/Projects/prod-agent/README.md`, which is currently empty. Before writing it, read `CLAUDE.md` — it is the accurate account of what this project is, and the README should agree with it rather than restate it. Facts that shape the output:

- **prod-agent is in the research/planning phase.** No `src/`, no implementation. A README promising installable software would be false. Lead with what the project is and where the specification lives (`.research/`, 11 documents), not with a Quick Start that has nothing to start.
- **Not a git repository.** No `.git`, no remote, no owner/repo. Every GitHub-hosted badge, `contrib.rocks` avatar block, and star-history chart must be omitted — the scan reports this in `notes` and `check-readme.ts` fails the README if one appears anyway. If the repo gains a remote later, the same scan starts returning `owner`/`repo` and those sections become available with no change to this skill.
- **No LICENSE, no CI workflows, no package.json.** So: no license badge, no build badge, no npm badge. `.github/` exists but is empty.
- **Stack is TypeScript + Bun**, with Python tooling via `uv`. If a command appears in the README it is a `bun` command.
- **`.claude/rules/design-standards.md` governs user-facing copy.** Its two banned registers apply to the README: no marketing language ("powerful", "seamless", "blazing fast") and no implementation language that asks the reader to understand the architecture before it has been explained.

## Workflow

### 1. Scan the project

```
bun ${CLAUDE_SKILL_DIR}/scripts/scan-project.ts <project-directory> --pretty
```

Returns JSON on stdout: project name, description, license, owner/repo, package manager, `is_git_repo`, CI provider and workflows, social links, top-two-level directory structure, top-level markdown docs, and a `notes` array naming each section to omit.

- `--include-hidden` puts dot-directories in the structure tree. **Use it for this repo** — without it the tree shows three markdown files, because `.research/` and `.claude/` are where prod-agent actually lives. `.git` is always skipped, and credential-bearing filenames (`.env`, `*.pem`, `*.key`, `.npmrc`) are never listed.
- `--no-network` skips the GitHub API homepage lookup and its social-link crawl — required offline, and the right default when the repo has no remote anyway.
- `--verbose` sends progress to stderr.

For this repo the full invocation is:

```
bun ${CLAUDE_SKILL_DIR}/scripts/scan-project.ts /Users/damionrashford/Projects/prod-agent --include-hidden --no-network --pretty
```

**Handling missing data:** empty fields mean absent, not unknown-so-guess. Never fabricate metadata. No CI means no build badge; no social links means no Connect section; no remote means no avatars, badges, or star history. Read `notes` and act on it.

### 2. Read the best practices guide

Read `references/readme-best-practices.md` before writing. It covers structure, tone, project-type adaptation, and the common pitfalls. Read it at write time, not at load time.

### 3. Build the README

Use `assets/readme-template.md` as the base structure and replace each `{{PLACEHOLDER}}` with real scan data.

Render the project tree the way people browse a repo: directories before files, alphabetized within each group, trailing `/` on directories. `scan-project.ts` already emits `directory_structure` in that order.

**Adapt — don't copy blindly.** Drop sections that don't apply and match the tone to the project:

- **Libraries/frameworks** — installation, API, minimal example
- **Applications** — setup, configuration, screenshots
- **Docs/specification repos** (what prod-agent is today) — structure and navigation; the document map is the substance
- **Small utilities** — hero, what it does, usage; nothing more
- **Monorepos** — package relationships, per-package doc links

### 4. Add badges

Read `assets/badges.json` for the catalog, grouped into status, social, and extras, with `{{PLACEHOLDER}}` markers for dynamic values. Use `style=for-the-badge` throughout.

**Golden rule:** only badges for things that actually exist. A badge for a nonexistent workflow or a guessed package is worse than no badge. For this repo that currently leaves zero badges — an honest hero with no badges beats a fabricated one.

### 5. Validate the output

```
bun ${CLAUDE_SKILL_DIR}/scripts/check-readme.ts <readme-path> --scan <scan.json> --pretty
```

Exits 1 on any failure and prints a JSON report. It catches leftover placeholders, stub sections, marketing vocabulary, badges and links the scan did not support, and install commands naming the wrong package manager. Pass `--scan` with the step-1 output — without it, only the content checks run.

Then read the assertions in `evals/evals.json` and check what the script cannot: that the description is accurate, that section depth is proportional to the project, and that the tone is direct.

To validate a draft without touching the user's file, write it to a scratch path and check that.

### 6. Optionally add a diagram

Read `assets/diagrams.md` only if the project has multiple components or a clear data flow. Skip it entirely otherwise. Generate the diagram from the project's actual structure — the templates are starting points to adapt, not to copy.
