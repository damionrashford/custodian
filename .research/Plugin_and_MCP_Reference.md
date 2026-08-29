# Plugin & MCP Server Reference — prod-agent

Audited directly from installed source (plugin caches under `~/.claude/plugins/cache/`, resolved via `~/.claude/plugins/installed_plugins.json`; project skills audited from each `SKILL.md`'s own frontmatter on disk). Every field below is quoted verbatim from disk, not recalled from training memory. Audited 2026-08-29, revised same day to drop Scrapling (removed) and add the project's own skills (grown from 3 to 12 since the original audit).

Scope: the 6 plugins enabled in `.claude/settings.json` (superpowers, context7, code-review, code-simplifier, typescript-lsp, adversaria), plus every skill currently under `.claude/skills/`. **No MCP servers are currently registered** — the Scrapling MCP server (`.mcp.json` → `ScraplingServer`) was fully removed: it lacked console/network-log capture, which `cdp-headless` covers instead. `.mcp.json` does not exist in this project anymore.

`pyright-lsp`, `rust-analyzer-lsp`, `swift-lsp`, and `ralph-loop` were disabled in the revision that added the Project skills section (§1) — none of Python/Rust/Swift exist in this TypeScript+Bun project, and Ralph Loop wasn't in use. `frontend-design` was disabled in a later revision — `studio` (§1) fully supersedes it: a 259-file design-system engine with the anti-slop/WCAG/token machinery Design & Interface Standards actually calls for, versus `frontend-design`'s single generic aesthetic-direction file. §2.2, §2.6, and §2.8 below document all five as they were audited, kept for reference in case any are re-enabled.

---

## 1. Project skills (`.claude/skills/`)

Audited from each skill's own `SKILL.md` frontmatter. 12 skills total. None ship an MCP server —
all are prompt/reference/script-based. A shared `tsconfig.json` sits at `.claude/skills/` root
(not a skill itself) — IDE type-checking scaffolding for every skill's `scripts/*.ts`, targets
`ES2022`/bundler resolution, `types: ["bun","node"]`.

| Skill | `description` (verbatim, trimmed only where noted) | Assets |
|---|---|---|
| `bun-docs` | "Search and fetch Bun's official documentation across docs, reference, guides, and blog. Use when the user asks about Bun APIs, the Bun runtime, bun:sqlite, Bun.file/Bun.write/Bun.serve, the bundler, test runner, package manager (bun install / bun add / bun pm), bun.com/reference signatures, bun.com/docs/guides recipes, or recent Bun release notes from the blog. Returns the matching doc sections (not just URLs) backed by a local cache at ~/.cache/bun-docs that survives offline." | `scripts/`: fetch.ts, index.ts, search.ts. `references/`: cache-layout.md, coverage-map.md, sections-llms-txt.md. `argument-hint: "[query] or [--refresh]"`, `license: MIT`. Backed by `~/.cache/bun-docs` (499 docs / 2901 chunks as of last refresh). |
| `gh` | "Use BEFORE running ANY gh command or answering ANY GitHub CLI question — reach for this skill instead of recalling gh syntax from training memory. Master the GitHub CLI: PRs, issues, repos, releases, GitHub Actions (workflow/run), gh api for arbitrary REST + GraphQL, auth and tokens, gists, codespaces, projects, secrets, labels. Sourced from the official cli.github.com/manual." (trigger list omitted) | `references/`: actions.md, api.md, auth.md, cheat-sheet.md, commands.md, gotchas.md, issue.md, pr.md, repo.md. Copied verbatim from `~/.claude/skills/gh`. |
| `graphify` | "Use for any question about a codebase, its architecture, file relationships, or project content — especially when graphify-out/ exists, where the question should be treated as a graphify query first. Turns any input (code, docs, papers, images, videos) into a persistent knowledge graph with god nodes, community detection, and query/path/explain tools." | `references/`: add-watch.md, exports.md, extraction-spec.md, github-and-merge.md, hooks.md, query.md, transcribe.md, update.md. Global skill (`~/.claude/skills/graphify`) that installed itself into this project. |
| `keep-changelog` | "Create, update, validate, and release CHANGELOG.md per Keep a Changelog 1.1.0. Use when the user mentions a changelog, CHANGELOG.md, release notes, cutting or tagging a release, an Unreleased section, or asks where to record a change." | `scripts/`: release.ts, validate.ts. `references/`: spec-1-1-0.md, writing-entries.md. |
| `playwright-cli` | Body vendored verbatim; **two frontmatter fields are deliberate local overrides**, not the upstream text (see below). | Body vendored verbatim from Microsoft's official skill, bundled with the installed `@playwright/test` (`node_modules/playwright-core/lib/tools/skills/playwright-cli/`), confirmed byte-identical to `github.com/microsoft/playwright-cli` main branch — don't paraphrase the body. `references/`: element-attributes.md, playwright-tests.md, request-mocking.md, running-code.md, session-management.md, storage-state.md, test-generation.md, tracing.md, video-recording.md. **Two exceptions, both re-apply on re-sync:** (1) upstream's `description` ("Automate browser interactions, test web pages and work with Playwright tests.") had no trigger keywords and wouldn't reliably auto-invoke — rewritten to front-load `--debug=cli`, `attach`, `snapshot`, plan→generate→heal, per the [Skills docs](https://code.claude.com/docs/en/skills)' own guidance. (2) upstream's `allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)` used colon syntax, which Claude Code doesn't parse (its syntax is `Bash(cmd *)`, space before the glob) — the field was cosmetic/inert as shipped; corrected to `Bash(playwright-cli *) Bash(npx *) Bash(npm *)`. |
| `react-router` | "Search the complete React Router documentation and API reference. Use when configuring routes, route modules, loaders, actions, forms, fetchers, navigation, pending UI, middleware, sessions, SSR/SPA/pre-rendering, RSC, URL and search params, or upgrading React Router — and when looking up any hook, component, or exported type." | `scripts/`: api.ts, fetch.ts, search.ts. `references/`: data-mode.md, declarative-mode.md, framework-mode.md, rsc.md. Backed by `~/.cache/react-router-docs`. |
| `readme-wizard` | "Write or improve a README — from scratch or polishing an existing one. Use when the user mentions the README, shields.io badges, a project structure tree, docs table, contributor avatars, a mermaid diagram, the repo's first impression, or making the project 'look professional'. Not for CHANGELOG, CONTRIBUTING, API docs, or CI setup." | `scripts/`: check-readme.ts, scan-project.ts. `references/`: readme-best-practices.md. Ported from `debs-obrien/learn-agent-skills`, adapted for this repo (default target: repo-root `README.md`). |
| `research` | "Manage the .research/ platform specification corpus — convert new .docx drops to verified .txt, and search the corpus for what it says about a topic with file:line citations. Use when new .docx files appear in .research/, when asked to convert or ingest research documents, before implementing any platform component, or when asked what the spec/research says about something." | `allowed-tools: Bash(textutil *), Bash(ls *), Bash(wc *), Bash(rm *), Bash(head *), Bash(grep *), Bash(rg *)`. `argument-hint: [ingest \| topic]`. Dispatches to Ingest or Lookup based on `$ARGUMENTS` — this is the merged successor to what were originally two separate skills (`ingest-research`, `spec-lookup`) in the initial scaffolding pass; those names no longer exist on disk. |
| `scaffold-component` | "Scaffold a new platform component's 4-layer directory structure (domain/application/infrastructure/interface) per Engineering Standards naming and layering rules." | `disable-model-invocation: true` (slash-command only, never auto-triggered). `argument-hint: [component-name]`. No `references/`/`scripts/`. |
| `studio` | Design-system skill — full description covers URL/screenshot/mood-board token extraction, design.json merge with WCAG contrast checking, anti-slop enforcement (21 macrostructures, 4 genres, 22 catalog themes, 71-gate slop test) (full verbatim string omitted for length; see `SKILL.md`). | `allowed-tools: Read Write Edit Glob Grep Bash(bun *) Bash(uv *) Bash(ls *) Bash(mkdir *) Bash(curl *) Bash(find *) Bash(mv *) Bash(jq *) Bash(echo *) Bash(test *) Agent AskUserQuestion WebFetch`. By far the largest skill on disk: 259 files (`scripts/design/`, `scripts/library/`, `lib/`, `knowledge/rules/` + `knowledge/playbooks/` with paired `.embeddings.json` per rule, `tests/`). Depends on the separate, external `~/.claude/skills/cdp-headless` skill for its mandatory post-emit screenshot step. |
| `testing` | "Use for anything touching prod-agent's test suite — writing a new test, running tests, a failing test, understanding tests/fixtures.ts or tests/seed.spec.ts, or where test artifacts land. Scoped to the tests/ folder and its two config files (playwright.config.ts, .playwright/cli.config.json)." | No `references/`/`scripts/` — deliberately lean, project-specific operational doc (layout, run commands, the two ways to add a test) rather than a Playwright API reference; points to the `playwright-cli` skill for exploration-driven authoring. |
| `typescript-7` | "TypeScript 7, typescript-go, tsgo — the native Go compiler port. Use when migrating TS 6 to TS 7, when a JSDoc tag, expando property, or CommonJS export that compiled under TS 6 now errors, or when asking whether a TS 7 component (language service, compiler API, build mode) is ready yet. Covers the TS 6 to 7 breaking-change list and the feature-parity table." | `scripts/`: fetch.ts, search.ts. No `references/` subfolder. Backed by `~/.cache/typescript-7`. |

**History note:** a 13th skill, `playwright` (a from-scratch, deep-research-authored Playwright API/config reference — 12 `references/*.md` files covering locators, assertions, fixtures, config, network, emulation, tracing, visual testing, CI/reporters, and mobile/Electron/MCP/Agent-CLI) was built earlier in this project's history, then deleted outright at the user's explicit request once the vendored `playwright-cli` skill (above) proved to be the more authoritative source for the CLI-facing half of that content; `testing` and `playwright-cli` together now cover what it was meant to.
---

## 2. Plugins

### 2.1 `superpowers` (v6.3.0) — `claude-plugins-official`

**Manifest** (`.claude-plugin/plugin.json`):
```json
{
  "name": "superpowers",
  "description": "Core skills library for Claude Code: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "6.3.0",
  "author": {"name": "Jesse Vincent", "email": "jesse@fsck.com"},
  "homepage": "https://github.com/obra/superpowers",
  "repository": "https://github.com/obra/superpowers",
  "license": "MIT",
  "keywords": ["skills","tdd","debugging","collaboration","best-practices","workflows"]
}
```
No `mcpServers` key. No `agents/` directory (confirmed no subagents ship with this plugin — `AGENTS.md` is a symlink to `CLAUDE.md`, not a Claude Code agent). No `commands/` directory.

**Skills** — 14 total, all under `skills/<name>/SKILL.md`:

| Skill | `description` (verbatim) |
|---|---|
| `brainstorming` | You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation. |
| `dispatching-parallel-agents` | Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies |
| `executing-plans` | Use when you have a written implementation plan to execute in a separate session with review checkpoints |
| `finishing-a-development-branch` | Use when implementation is complete, all tests pass, and you need to decide how to integrate the work |
| `receiving-code-review` | Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation |
| `requesting-code-review` | Use when completing tasks, implementing major features, or before merging to verify work meets requirements |
| `subagent-driven-development` | Use when executing implementation plans with independent tasks in the current session |
| `systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes |
| `test-driven-development` | Use when implementing any feature or bugfix, before writing implementation code |
| `using-git-worktrees` | Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git worktree fallback |
| `using-superpowers` | Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions |
| `verification-before-completion` | Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code |
| `writing-skills` | Use when creating new skills, editing existing skills, or verifying skills work before deployment |

Notable skill assets: `brainstorming/scripts/` (frame-template.html, helper.js, server.cjs, start-server.sh, stop-server.sh); `subagent-driven-development/scripts/` (review-package, sdd-workspace, task-brief — extensionless bash executables); `using-superpowers/references/` (antigravity-tools.md, codex-tools.md, gemini-tools.md, hermes-tools.md, pi-tools.md); `writing-skills/` (anthropic-best-practices.md, persuasion-principles.md, render-graphs.js, testing-skills-with-subagents.md, examples/CLAUDE_MD_TESTING.md).

**Hooks** — `hooks/hooks.json`:
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup|clear|compact",
      "hooks": [{
        "type": "command",
        "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start",
        "shell": "bash",
        "async": false
      }]
    }]
  }
}
```
Effect (`hooks/session-start` script): injects the full text of `skills/using-superpowers/SKILL.md` as `additionalContext` on every session start/clear/compact — this is exactly the `<EXTREMELY_IMPORTANT>` block seen at the top of this and every session. `run-hook.cmd` is a polyglot batch/bash wrapper for cross-platform dispatch (extensionless script names to dodge Windows' auto-`bash` detection on `.sh` files). A second file `hooks/hooks-cursor.json` exists for the Cursor-harness schema variant; not read by Claude Code.

---

### 2.2 `frontend-design` — `claude-plugins-official` (no version field)

**Manifest:**
```json
{
  "name": "frontend-design",
  "description": "Frontend design skill for UI/UX implementation",
  "author": {"name": "Anthropic", "email": "support@anthropic.com"}
}
```
No `agents/`, `hooks/`, `commands/`, or `references/` directories. No `mcpServers` key.

**Skills** — exactly one:
```yaml
---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.
license: Complete terms in LICENSE.txt
---
```
Skill folder contains only `SKILL.md` + `LICENSE.txt` — no `scripts/` or `references/` subdirectories.

---

### 2.3 `context7` — `claude-plugins-official` (no version field)

**Manifest:**
```json
{
  "name": "context7",
  "description": "Upstash Context7 MCP server for up-to-date documentation lookup. Connects to Context7's hosted remote MCP server (https://mcp.context7.com/mcp) — no local Node.js or npx required — to pull version-specific documentation and code examples directly from source repositories into your LLM context. Works anonymously out of the box; set CONTEXT7_API_KEY for higher rate limits.",
  "author": {"name": "Upstash"}
}
```
No `skills/`, `agents/`, `hooks/`, or `commands/` directories exist in the installed cache copy — this plugin ships **only** the manifest, a `.mcp.json`, and a README (the README itself states the upstream `upstash/context7` repo has "skills, agents, and commands" that are not present in this installed subset).

**MCP server** — `.mcp.json` (plugin root):
```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {"Authorization": "${CONTEXT7_API_KEY:-}"}
    }
  }
}
```
Hosted remote HTTP server — no local process, no npx invocation. Two tools per README: `resolve-library-id` (search libraries, returns Context7 IDs like `/vercel/next.js` + available versions) and `query-docs` (fetch docs for a specific library, ranked by relevance). Matches the live deferred-tool names `mcp__plugin_context7_context7__resolve-library-id` / `mcp__plugin_context7_context7__query-docs` seen in this session.

---

### 2.4 `code-review` — `claude-plugins-official` (no version field in plugin.json; README claims v1.0.0)

**Manifest:**
```json
{
  "name": "code-review",
  "description": "Automated code review for pull requests using multiple specialized agents with confidence-based scoring",
  "author": {"name": "Anthropic", "email": "support@anthropic.com"}
}
```
**Discrepancy:** `plugin.json` author is "Anthropic <support@anthropic.com>"; `README.md` separately credits "Boris Cherny (boris@anthropic.com)" and states "Version 1.0.0" — plugin.json has no version field at all.

No `skills/`, `agents/`, or `hooks/` directories. Exactly one file under `commands/`.

**Command** — `commands/code-review.md`:
```yaml
---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*)
description: Code review a pull request
disable-model-invocation: false
---
```
No `argument-hint`. Body defines an 8-step pipeline: (1) Haiku agent filters out closed/draft/already-reviewed/trivial PRs, (2) Haiku agent lists relevant `CLAUDE.md` paths, (3) Haiku agent summarizes the PR, (4) 5 parallel Sonnet agents each review independently — CLAUDE.md compliance, shallow bug scan, git-blame historical context, prior-PR comment relevance, in-code comment compliance, (5) per-issue Haiku confidence scorer on a 0/25/50/75/100 rubric (exact rubric text embedded in command body), (6) filter to confidence **≥ 80** (adjustable by editing this literal number in the file), (7) re-run the eligibility check from step 1, (8) post a `gh pr comment` in a fixed Markdown format (must cite full 40-char git SHA + `L<start>-L<end>` line ranges, ≥1 line of context each side). Explicit false-positive exclusion list embedded (pre-existing issues, lint/typecheck-catchable issues, pedantic nitpicks, etc.). No `--comment` or `--fix` flags exist anywhere in this file — this command always posts directly via `gh pr comment`.

> **Naming collision (flagged for accuracy):** the unprefixed `code-review` entry in this session's skill catalog ("Review the current diff, or a PR number/branch/path target... Pass --comment to post findings as inline PR comments, or --fix to apply the findings...") is a **different, bundled Claude Code skill**, not this plugin. This plugin's `/code-review` only reviews GitHub PRs via `gh`, has no `--comment`/`--fix`/effort-level flags, and always posts a PR comment. Same collision exists for `code-simplifier` (plugin, §2.5) vs. the bundled `simplify` skill.

---

### 2.5 `code-simplifier` (v1.0.0) — `claude-plugins-official`

**Manifest:**
```json
{
  "name": "code-simplifier",
  "version": "1.0.0",
  "description": "Agent that simplifies and refines code for clarity, consistency, and maintainability while preserving functionality",
  "author": {"name": "Anthropic", "email": "support@anthropic.com"}
}
```
No `skills/`, `hooks/`, `commands/`. Exactly one file under `agents/`.

**Agent** — `agents/code-simplifier.md`:
```yaml
---
name: code-simplifier
description: Simplifies and refines code for clarity, consistency, and maintainability while preserving all functionality. Focuses on recently modified code unless instructed otherwise.
model: opus
---
```
No `tools:` key present at all — meaning no explicit restriction; the agent inherits full default tool access (confirmed by this session's own agent roster showing `code-simplifier:code-simplifier — (Tools: All tools)`).

---

### 2.6 `ralph-loop` (v1.0.0) — `claude-plugins-official`

**Manifest:**
```json
{
  "name": "ralph-loop",
  "version": "1.0.0",
  "description": "Continuous self-referential AI loops for interactive iterative development, implementing the Ralph Wiggum technique. Run Claude in a while-true loop with the same prompt until task completion.",
  "author": {"name": "Anthropic", "email": "support@anthropic.com"}
}
```
No `skills/`, `agents/`, `references/` directories. Has `hooks/` and `commands/`.

**Commands** (3, all under `commands/`):

`commands/ralph-loop.md`:
```yaml
---
description: "Start Ralph Loop in current session"
argument-hint: "PROMPT [--max-iterations N] [--completion-promise TEXT]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-ralph-loop.sh:*)"]
hide-from-slash-command-tool: "true"
---
```
Runs `scripts/setup-ralph-loop.sh $ARGUMENTS`, which creates `.claude/ralph-loop.local.md` (state: `active`, `iteration`, `session_id`, `max_iterations`, `completion_promise`, `started_at`, then the prompt body) and `RALPH_PROGRESS.md`. `--max-iterations <n>` must match `^[0-9]+$` (0 = unlimited). `--completion-promise '<text>'` — quoting required for multi-word phrases; case-insensitive match, supports regex alternation (e.g. `DONE|BLOCKED`). Any unrecognized tokens are joined as the prompt.

`commands/cancel-ralph.md`:
```yaml
---
description: "Cancel active Ralph Loop"
allowed-tools: ["Bash(test -f .claude/ralph-loop.local.md:*)", "Bash(rm .claude/ralph-loop.local.md)", "Read(.claude/ralph-loop.local.md)"]
hide-from-slash-command-tool: "true"
---
```
No `argument-hint`. Checks for `.claude/ralph-loop.local.md`, reports the current iteration, deletes the file.

`commands/help.md`:
```yaml
---
description: "Explain Ralph Loop plugin and available commands"
---
```
No `argument-hint`, no `allowed-tools`, no `hide-from-slash-command-tool` (unlike the other two). Explains the technique, both commands, the `<promise>TEXT</promise>` completion signal, and when to/not to use Ralph. **Contains its own internal typo**: twice references the state file as `.claude/.ralph-loop.local.md` (leading dot) — the actual file (per `setup-ralph-loop.sh`, `stop-hook.sh`, and `cancel-ralph.md`) is `.claude/ralph-loop.local.md` (no leading dot).

**Hook** — `hooks/hooks.json` (only one event registered):
```json
{
  "description": "Ralph Loop plugin stop hook for self-referential loops",
  "hooks": {
    "Stop": [{
      "hooks": [{"type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/stop-hook.sh\""}]
    }]
  }
}
```
`hooks/stop-hook.sh` (245 lines) on every `Stop` event: reads `.claude/ralph-loop.local.md`; if absent, allows normal exit. Validates `iteration`/`max_iterations` are numeric. Session-isolation check via `.session_id` in hook stdin vs. state file's `session_id` (legacy state files without one fall through). If `iteration >= max_iterations > 0`: prints a stop banner, deletes state, allows exit. Otherwise scans the transcript's last 100 assistant-role lines for a `<promise>...</promise>` tag (Perl regex `s/.*?<promise>(.*?)<\/promise>.*/$1/s`), and if it case-insensitively matches the stored `completion_promise` regex, deletes state and allows exit. Otherwise: increments iteration, computes a phase (`early` ≤5, `mid` ≤15, `late` >15, each with a distinct hint string), gathers `git diff --name-only HEAD` (max 8 files) and the last 30 lines of `RALPH_PROGRESS.md`, and re-blocks the Stop event via `{"decision":"block","reason":<augmented prompt>,"systemMessage":<phase status>}` — feeding the same original prompt back in, augmented with iteration/phase/file/progress context.

---

### 2.7 `adversaria` (v2.0.0) — `damionrashford-adversaria` (personal marketplace)

**Manifest** (`.claude-plugin/plugin.json` — no `version` field; version only lives in the sibling `marketplace.json`):
```json
{
  "name": "adversaria",
  "description": "Critical thinking platform for decision analysis, proposal review, debate preparation, and due diligence. Three agents (advocate, adversary, judge) with a structured argument graph, sequential thought chain, and 10 reasoning traditions.",
  "author": {"name": "Damion Rashford", "url": "https://github.com/damionrashford"},
  "homepage": "https://github.com/damionrashford/Adversaria",
  "repository": "https://github.com/damionrashford/Adversaria",
  "license": "MIT",
  "keywords": ["critical-thinking","adversarial-reasoning","argument-analysis","decision-making","red-team","steelmanning","socratic-method","due-diligence","debate"]
}
```
`marketplace.json` gives a **different** description string for the plugin entry ("Critical thinking platform: argue, stress-test, and judge any idea with a structured argument graph, three specialized agents, and 10 reasoning traditions.") plus `"version": "2.0.0"`.

No `commands/` directory — the 4 slash-invocable capabilities are all skills, not commands.

**Skills** — 4, all under `skills/<name>/SKILL.md`:

`skills/crucible/SKILL.md`:
```yaml
---
name: crucible
description: >
  Stress-test any idea, proposal, or plan by finding its weakest points, probing hidden assumptions with Socratic questions, and identifying failure modes through red team analysis. Use when the user asks to stress-test, poke holes, find weaknesses, red team, challenge, or ask 'what could go wrong' or 'what am I missing'.
argument-hint: "idea, plan, or proposal to stress-test"
---
```

`skills/devils-advocate/SKILL.md`:
```yaml
---
name: devils-advocate
description: >
  Full adversarial analysis of any idea, proposal, or argument. Runs steelman, crucible, and verdict in sequence for a complete challenge drawing from 10 reasoning traditions. Use when the user asks to play devil's advocate, run a full challenge, or says 'tear this apart' or 'give me the full treatment'.
argument-hint: "idea, plan, or argument to challenge"
---
```

`skills/verdict/SKILL.md`:
```yaml
---
name: verdict
description: >
  Deliver a structured verdict on any idea, argument, or proposal, identifying what survives scrutiny, what doesn't, and what needs more work. Includes the gadfly sting, the one uncomfortable truth nobody wants to say. Use when the user asks for a verdict, bottom line, final assessment, 'what survives', or 'give it to me straight'.
argument-hint: "idea, argument, or proposal to judge"
---
```

`skills/steelman/SKILL.md` (the only skill with a per-skill hook):
```yaml
---
name: steelman
description: >
  Build the strongest possible version of an argument, then argue the complete opposite with equal conviction. Use when the user asks to steelman something, argue both sides, make the strongest case, or understand the best version of an opposing view.
argument-hint: "idea, argument, or position to steelman"
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "\"${CLAUDE_PLUGIN_ROOT}/hooks/scripts/auto-init.sh\""
          once: true
---
```

**Agents** — 3, all under `agents/`, all with `tools: Read, Bash, Grep, Glob` (identical set across all three):

| Agent | `model` | `skills` | `memory` | `effort` | `maxTurns` |
|---|---|---|---|---|---|
| `adversary` | `sonnet` | `adversaria:crucible` | `project` | `high` | `25` |
| `advocate` | `sonnet` | `adversaria:steelman` | `project` | `high` | `20` |
| `judge` | `inherit` | `adversaria:verdict` | `project` | `high` | `15` |

Descriptions verbatim: **adversary** — "Finds every weakness, flaw, and failure mode in an idea. Authentic dissenter, not assigned devil's advocacy. Use proactively when stress-testing, red teaming, poking holes, or when the user asks what could go wrong, what they're missing, or to challenge something." **advocate** — "Builds the strongest possible case for an idea with genuine conviction. Not neutral analysis, authentic advocacy. Use proactively when the user asks to steelman, make the best case, argue both sides, or defend an idea." **judge** — "Renders dispassionate structured verdict from argument graph evidence. No advocacy in either direction. Use after advocate and adversary have contributed to the graph, or standalone when the user asks for a verdict, bottom line, or final assessment."

**Hooks** — plugin-level `hooks/hooks.json` (5 events registered):

| Event | Matcher | Script | Mode |
|---|---|---|---|
| `SessionStart` | `startup\|resume` | `hooks/scripts/session-restore.sh` | sync, `statusMessage: "Checking for prior analysis state..."` |
| `PreToolUse` | `Bash` | `hooks/scripts/graph-validate.sh` | sync, `statusMessage: "Validating graph operation..."` |
| `PostToolUse` | `Bash` | `hooks/scripts/auto-analyze.sh` | `async: true` |
| `SubagentStop` | `advocate\|adversary` (**not** `judge**`) | `hooks/scripts/agent-summary.sh` | sync, `statusMessage: "Capturing agent findings..."` |
| `Stop` | *(none — fires unconditionally)* | `hooks/scripts/session-save.sh` | `async: true` |

Plus one skill-scoped hook not in `hooks.json`: `skills/steelman/SKILL.md`'s frontmatter registers `PreToolUse`/`Bash` → `hooks/scripts/auto-init.sh` with `once: true`.

Exact mechanics:
- `session-restore.sh`: reads `$CLAUDE_PLUGIN_DATA/last-graph.jsonl` + `last-chain.json` (falls back to `/tmp/adversaria-data`), counts entities/relations via `grep -c`, injects a restore hint as `additionalContext`.
- `graph-validate.sh`: only fires on Bash commands containing `argument-graph.py`. For `add` subcommands: entity name must be kebab-case (rejects `[A-Z ]`, exit 2), entity type must be one of `claim|assumption|evidence|weakness|counter|precedent|mitigation` (exit 2 otherwise). For `relate` subcommands: relation type must be one of `supports|undermines|assumes|depends_on|contradicts|if_fails|mitigates` (exit 2 otherwise).
- `auto-analyze.sh`: only fires on `argument-graph.py add|relate`; runs `uv run <script> analyze` and injects the result as `additionalContext`.
- `agent-summary.sh`: on `advocate`/`adversary` subagent stop, if `/tmp/devils-advocate-graph.jsonl` exists, runs `uv run scripts/argument-graph.py analyze` and injects `Agent "<type>" completed. Current graph state: <analysis>`.
- `session-save.sh`: on every `Stop`, copies `/tmp/devils-advocate-graph.jsonl` → `$DATA_DIR/last-graph.jsonl` (+ runs `export`/`verdict` via `argument-graph.py`) and `/tmp/devils-advocate-chain.json` → `$DATA_DIR/last-chain.json` (+ `render` via `thought-chain.py`), reporting `Analysis saved to $DATA_DIR`.
- `auto-init.sh` (steelman-only, `once: true`): on first `argument-graph.py`/`thought-chain.py` call, if `/tmp/devils-advocate-graph.jsonl` already has content, skips reset; otherwise runs `reset` on both scripts.

Backing scripts: `scripts/argument-graph.py`, `scripts/thought-chain.py` at plugin root (duplicated again inside `skills/devils-advocate/scripts/`). State lives in `/tmp/devils-advocate-graph.jsonl` and `/tmp/devils-advocate-chain.json` during a session; persisted to `$CLAUDE_PLUGIN_DATA` (or `/tmp/adversaria-data`) on `Stop`.

---

### 2.8 LSP plugins — `typescript-lsp`, `pyright-lsp`, `rust-analyzer-lsp`, `swift-lsp` (all v1.0.0, `claude-plugins-official`)

**Structural note:** none of the 4 installed cache copies contain a `.claude-plugin/plugin.json` — each installed root has only `LICENSE`, `README.md`, and `.in_use/` (PID lock files). The authoritative manifest for each lives centrally in the marketplace file `~/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json`, byte-identical to the resolved runtime cache at `~/.claude/plugins/plugin-catalog-cache.json`. No `skills/`, `agents/`, `hooks/`, or `commands/` exist for any of the four. No `mcpServers` key on any of them.

| Field | typescript-lsp | pyright-lsp | rust-analyzer-lsp | swift-lsp |
|---|---|---|---|---|
| `description` | TypeScript/JavaScript language server for enhanced code intelligence | Python language server (Pyright) for type checking and code intelligence | Rust language server for code intelligence and analysis | Swift language server (SourceKit-LSP) for code intelligence |
| `lspServers` key | `typescript` | `pyright` | `rust-analyzer` | `sourcekit-lsp` |
| `command` | `typescript-language-server` | `pyright-langserver` | `rust-analyzer` | `sourcekit-lsp` |
| `args` | `["--stdio"]` | `["--stdio"]` | *(none)* | *(none)* |
| `extensionToLanguage` | `.ts`→typescript, `.tsx`→typescriptreact, `.js`→javascript, `.jsx`→javascriptreact, `.mts`→typescript, `.cts`→typescript, `.mjs`→javascript, `.cjs`→javascript | `.py`→python, `.pyi`→python | `.rs`→rust | `.swift`→swift |
| Install (per README) | `npm install -g typescript-language-server typescript` | `npm install -g pyright` (or `pip`/`pipx install pyright`) | `rustup component add rust-analyzer` (or brew/apt/pacman) | bundled with Xcode / `brew install swift` |
| `author` | Anthropic <support@anthropic.com> for all four | | | |
| `category` | `development` for all four | | | |
| `strict` | `false` for all four | | | |

Note: `rust-analyzer` and `sourcekit-lsp` are registered with **no `args` array at all** (unlike the two that pass `--stdio` explicitly).

---

## 3. Naming collisions / gotchas (accuracy-critical)

1. **`code-review` (bundled skill) ≠ `code-review` plugin.** The bundled skill supports `--comment`/`--fix` and effort levels (low/medium/high/xhigh/max) on arbitrary diffs/PRs/branches. The `code-review` **plugin**'s `/code-review` command is PR-only via `gh`, always posts a comment, has no such flags, and runs a fixed 8-step 5-agent pipeline with a hardcoded confidence threshold of 80.
2. **`simplify` (bundled skill) ≠ `code-simplifier` plugin.** The bundled `simplify` skill reviews+applies fixes for reuse/simplification/efficiency. The plugin ships only a single `code-simplifier` **agent** (opus model, unrestricted tools) with no accompanying skill or command.
3. **`ralph-loop` plugin's own `help.md`** documents the state file as `.claude/.ralph-loop.local.md` (leading dot) in two places; the actual file used everywhere else (setup script, stop hook, cancel command) is `.claude/ralph-loop.local.md` (no leading dot).
4. **`ralph-loop`'s README** references a Windows-workaround cache path containing `ralph-wiggum` instead of `ralph-loop` — a typo in the README, not the actual installed directory name.
5. **`code-review` plugin.json vs README** disagree on both `version` (absent vs. "1.0.0") and `author` (Anthropic/support@anthropic.com vs. Boris Cherny/boris@anthropic.com).
6. **`adversaria` plugin.json vs marketplace.json** carry two different description strings for the same plugin; version (`2.0.0`) exists only in marketplace.json.
7. **`context7` plugin** is a stripped installed subset — its own README states the upstream repo also ships skills/agents/commands that are not present in this Claude Code plugin cache.

---

## 4. Resolved install paths (from `~/.claude/plugins/installed_plugins.json`)

| Plugin | Marketplace | Version | Install path |
|---|---|---|---|
| superpowers | claude-plugins-official | 6.3.0 | `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0` |
| frontend-design | claude-plugins-official | ed404106fcd8 (rolling) | `.../frontend-design/ed404106fcd8` |
| context7 | claude-plugins-official | ed404106fcd8 (rolling) | `.../context7/ed404106fcd8` |
| code-review | claude-plugins-official | ed404106fcd8 (rolling) | `.../code-review/ed404106fcd8` |
| code-simplifier | claude-plugins-official | 1.0.0 | `.../code-simplifier/1.0.0` |
| typescript-lsp | claude-plugins-official | 1.0.0 | `.../typescript-lsp/1.0.0` |
| pyright-lsp | claude-plugins-official | 1.0.0 | `.../pyright-lsp/1.0.0` |
| rust-analyzer-lsp | claude-plugins-official | 1.0.0 | `.../rust-analyzer-lsp/1.0.0` |
| swift-lsp | claude-plugins-official | 1.0.0 | `.../swift-lsp/1.0.0` |
| ralph-loop | claude-plugins-official | 1.0.0 | `.../ralph-loop/1.0.0` |
| adversaria | damionrashford-adversaria | 2.0.0 | `~/.claude/plugins/cache/damionrashford-adversaria/adversaria/2.0.0` |

`frontend-design`, `context7`, and `code-review` use a rolling content-hash "version" (`ed404106fcd8`) instead of semver — they auto-update via `lastUpdated` timestamps rather than version bumps.

No MCP servers are registered in this project (see the scope note at the top of this document).
