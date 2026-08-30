# Custodian

Enterprise-grade autonomous AI agent platform. `.research/` holds the spec corpus and is the source of truth for *what to build* (search it with the `research` skill/subagent rather than reading this file for what it says); this file and `.claude/` are the scaffolding.

**Implementation status.** Stages 0–3 are built: toolchain gates, foundations F1–F3, serving core (C1, C2, C3, C4, C21) and knowledge/context (C5, C6, C7, C8). Fourteen packages under `packages/`, 104 tests, seven CI gates plus a standing erasure gate, all behind `bun run verify`. Stage plans live in `.research/superpowers/plans/` (git-ignored) and each carries an execution status header. Architectural decisions the spec left open are recorded in `.claude/rules/locked-decisions.md` — **read that before re-deciding anything**, because the reasoning is not obvious from the code. That file is **machine-local**: `/.claude/` is git-ignored, so it is absent from a fresh clone and the decisions have to be re-derived from the commit messages, which carry the same reasoning.

## Non-negotiables

Findings that override intuition — check before designing around them. Decisions resolved *during* implementation, with what would reopen them, are in `.claude/rules/locked-decisions.md`.

- **Foundation F3 (execution log) is the single highest-leverage component**, not a line item. It's the one artefact that satisfies GDPR erasure evidence, Art. 73 incident reporting, SOC 2 evidence, and memory provenance simultaneously. Build it properly in Phase 1, not iteratively.
- **Routing is a learned system** (C18), not a failover rule table. Needs its own eval/replay pipeline before it's "done."
- **Semantic caching is conditional**, not default — ships only behind a measured false-positive rate, and cache invalidation is part of the rollback path (a stale cache extends every incident).
- **MicroVM isolation, not containers**, for any untrusted code execution (Component 10). Containers are not defensible for this threat model.
- **Tool definitions load progressively**, never preloaded — MCP tool preloading is the single largest source of wasted context and measurably degrades tool-selection accuracy.
- **Residency is a routing constraint**, not a config flag — the fallback chain must refuse rather than silently cross a data-residency boundary.
- **Crypto-shred, never soft-delete**, for any data-subject erasure — vector stores keep embeddings on disk after a "delete."
- **Swarm/peer-handoff orchestration is out** — hub-and-spoke is the production pattern; swarm is incompatible with this platform's incident-response posture (execution paths must stay traceable).

## Architecture spine

Four layers, dependencies point inward only (full detail: `.claude/rules/engineering-standards.md`):

`domain` (zero I/O) ← `application` (use cases) ← `infrastructure` (adapters) ← `interface` (HTTP/workers/CLI)

TypeScript, strict-beyond-strict, enforced by `tsc`/ESLint/`dependency-cruiser` in CI — not by convention.

One implementation of anything, at any moment. A change updates every upstream caller and downstream
consumer and deletes what it replaced, in the same change — no stubs, flags, shims, aliases, or `v2`
suffixes holding an unfinished migration open (`.claude/rules/change-discipline.md`).

## Stack

TypeScript + Bun runtime. Python tooling, where needed, via `uv` with PEP 723 inline metadata.

## Mandatory skills — not suggestions

Every row below is a **MUST**. These instructions already existed in prose further down and were
ignored across an entire build (25 packages shipped with zero code review, an empty CHANGELOG, and
the spec corpus read by hand instead of through `research`). They are a table now because a rule
buried in a paragraph is a rule that gets skipped.

**The test for every row: if you are about to do the thing in the left column and you have not
invoked the skill in the right column this session, you are doing it wrong. Stop and invoke it.**

| About to… | MUST invoke first |
|---|---|
| Answer "what does the spec say about X", or implement anything from `.research/` | `research` — never read `.research/*.txt` directly to answer a spec question |
| Create a new platform component's folders | `scaffold-component` — hand-rolling the 4 layers is a violation even when the result looks right |
| Plan any multi-step work | `superpowers:writing-plans` |
| Execute a written plan | `superpowers:executing-plans` or `superpowers:subagent-driven-development` |
| Lock in an architectural decision the spec left open | `adversaria:devils-advocate` before it becomes a Non-negotiable |
| Land code in a component | The **review pipeline** below, in order — all of it |
| Claim anything passed, shipped, or is done | `superpowers:verification-before-completion` — assert nothing you have not run |
| Record a shipped change | `keep-changelog` — `CHANGELOG.md` is a release artefact, not an afterthought |
| Touch `README.md`, or ship a change that dates it | `readme-wizard` |
| Write or run anything under `tests/` | `testing` |
| Drive a browser, fetch a page, or search the web | `bun-webview` — `WebFetch`/`WebSearch`/`curl` are denied on purpose; this is the one path |
| Answer a Bun / TypeScript-7 / React-Router / `gh` question | `bun-docs` / `typescript-7` / `react-router` / `gh` — never from training memory |
| Ask how parts of this codebase relate | `graphify` first — the graph is at `.graphify/`, per `GRAPHIFY_OUT` |
| Build any UI surface | `studio` (design system) with `frontend-design` |

### Review pipeline — every component, in this order, before merge

1. `code-simplifier:code-simplifier` agent — clarity
2. bundled `code-review` skill — bugs and security on the diff
3. `layer-reviewer` subagent — layering, banned constructs, naming
4. `compliance-reviewer` subagent — **required** whenever the change touches personal data, memory,
   retrieval, caching or logging. This is the reviewer that catches an unsealed store or a location
   missing from the erasure data map, and skipping it is how those reach `main`.
5. `code-review@claude-plugins-official` `/code-review` — final gate, PR-only, posts via `gh`

Do not confuse step 5 with step 2; they share a name. `.research/Plugin_and_MCP_Reference.md` §3
lists the full collision set.

## Parallelise — this is a MUST, not a preference

**Every tool call that does not consume the output of another goes in the same block as that other
call.** Serialising independent work is the single largest source of wasted time in this repo, and
it is invisible in the result: the diff looks identical, the wall-clock is many times worse.

The test before every response: *of the calls I am about to make, which one needs an answer I do not
already have?* Only that one waits. Everything else ships now, together.

| Situation | Wrong | Right |
|---|---|---|
| Need to see four files | Four `Read` turns | One block, four `Read` calls |
| Editing six unrelated files | Six `Edit` turns | One block, six `Edit`/`Write` calls, or one scripted pass |
| Patching N call sites after a rename | One at a time, typecheck between each | One scripted pass over all N, then **one** typecheck |
| Running gates | `typecheck`, then `lint`, then `test` | `bun run verify` |
| Proving several gates non-vacuous | A turn per plant | One block: plant, run, restore, repeat |
| Two independent reviews | One agent, wait, next agent | Both agents dispatched in one block |

Two rules that make this work in practice:

- **Let the typechecker batch the errors for you.** Do not fix one compile error, re-run, fix the
  next. Make the whole change, run `tsc` once, fix every error it lists in one pass. The compiler is
  already a parallel error report — reading it one line per turn discards that.
- **Scripted edits beat per-file turns** for anything mechanical (a rename, a moved export, a
  changed signature). One `python3`/`sed` pass over the whole blast radius, then verify once. This
  is also what `change-discipline.md` demands anyway — the whole blast radius moves together.

The exception is genuine dependency: you cannot patch call sites before deciding the new signature,
and you cannot claim a gate passes before running it. Sequence those. Nothing else.

## Working in this repo

- New research drops land as `.docx` in `.research/` — run the `research` skill (or the `research` subagent for a heavier pass, which can also chase down external prior art the corpus doesn't cover) to convert and verify.
- Before answering "what does the spec say about X" or before implementing anything, use the `research` skill/subagent rather than guessing — the corpus is large (11 docs, ~2,500 lines) and has already resolved most open questions. For "how does X relate to Y" architecture questions, query the standing knowledge graph first — it is cheaper than re-exploring. It lives at **`.graphify/`**, the path `GRAPHIFY_OUT` in `.claude/settings.json` sets, **not** `graphify-out/`. Gating on `graphify-out/` made the skill unreachable for an entire build, because that directory never exists under this configuration.
- **Superpowers writes every document it produces under `.research/superpowers/`**, never `docs/superpowers/`. Same subfolders and filename convention as the plugin's own layout, different root: `superpowers:brainstorming` → `.research/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, `superpowers:writing-plans` → `.research/superpowers/plans/YYYY-MM-DD-<feature>.md`. Every downstream reference (SDD plan paths, `requesting-code-review` `PLAN_OR_REQUIREMENTS`) uses the `.research/superpowers/` path. This is not the spec corpus: the corpus is `.research/*.txt` at top level only. All of `.research/` is git-ignored on purpose, so **skip the "and commit" step** both skills end with — the artefact is the file on disk, and reporting a commit that git ignored is a false completion claim. Three superpowers outputs stay outside `.research/` because the plugin hardcodes their paths in scripts, not prose: the SDD workspace (`.superpowers/sdd/<plan-slug>/` — ledger, briefs, reports), the visual-companion session dir (`.superpowers/brainstorm/<id>/` — mockups; pass `--project-dir` at the *repo root* so they persist past `/tmp`), and worktrees (`.worktrees/`). All three are git-ignored.
- Before scaffolding anything, use the `superpowers:writing-plans` skill to turn the spec section into a concrete plan — `scaffold-component` lays out folders, it doesn't replace planning. For any *new* architectural decision not already resolved in `Gap_Register_v2.txt` (a routing-model choice, a caching strategy), run the `adversaria:devils-advocate` skill against it before it becomes a locked entry in Non-negotiables above.
- Scaffolding a new platform component (Phase 1–5 or the addendum's C18–C23): use the `scaffold-component` skill — it lays out the 4-layer folders and stub port/adapter per Engineering Standards.
- Review pipeline, in order, once a component has code: the `code-simplifier:code-simplifier` agent (clarity) → bundled `code-review` skill (bugs/security on the diff) → `layer-reviewer` subagent (layering, banned constructs, naming) → `compliance-reviewer` subagent, only if the change touches personal data, memory, retrieval, or logging (crypto-shred usage, execution-log fields, tenant isolation) → the `code-review@claude-plugins-official` plugin's `/code-review` command as the final gate before merge (PR-only, posts via `gh`, fixed 5-agent pipeline — don't confuse it with the bundled skill of the same name, see `.research/Plugin_and_MCP_Reference.md` §3 for the full collision list). Before claiming any of this passed, run the `superpowers:verification-before-completion` skill rather than asserting it.
- Library docs: `bun-docs`/`react-router`/`typescript-7` skills win for their ecosystems (dedicated, higher-fidelity local caches, offline-survivable); reach for the `context7@claude-plugins-official` MCP server (tools prefixed `mcp__plugin_context7_context7__`) only for a library none of those three cover.

## Definition of done (per plan v2, §10)

All 17 components + F1–F3 deployed and passing their eval gate; idempotency/auth verified under chaos testing; workflow replay verified across a deployment boundary; cost dashboard reconciles to zero variance for two billing cycles; sandbox escape review signed off; constraint pinning verified to survive compaction; guardrail FP/FN rates measured; prompt rollback rehearsed under 60s; Article 50 + logging retention signed off by Legal.

## graphify

This project has a knowledge graph at **`.graphify/`** — the path `GRAPHIFY_OUT` in `.claude/settings.json` sets, **not** `graphify-out/`. Every `graphify` command inherits that variable and resolves it automatically; you never pass a path. It holds god nodes, community structure and cross-file relationships for all 25 packages.

Rules:
- For codebase questions, run `graphify query "<question>"` **first**, before grepping. A PreToolUse hook enforces this. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If `.graphify/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` (AST-only, no API cost). The post-commit hook does this automatically; both hooks pin `GRAPHIFY_OUT` because they run outside the Claude session, where `.claude/settings.json` env does not apply.
