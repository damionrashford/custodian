# Custodian

Enterprise-grade autonomous AI agent platform — currently in the **research/planning phase**. No implementation code exists yet. `.research/` is the source of truth (search it with the `research` skill/subagent rather than reading this file for what it says); this file and `.claude/` are the scaffolding for building it.

## Non-negotiables

Findings that override intuition — check before designing around them:

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

## Stack

TypeScript + Bun runtime. Python tooling, where needed, via `uv` with PEP 723 inline metadata.

## Working in this repo

- New research drops land as `.docx` in `.research/` — run the `research` skill (or the `research` subagent for a heavier pass, which can also chase down external prior art the corpus doesn't cover) to convert and verify.
- Before answering "what does the spec say about X" or before implementing anything, use the `research` skill/subagent rather than guessing — the corpus is large (11 docs, ~2,500 lines) and has already resolved most open questions. If `graphify-out/` exists once real code lands, check it first for "how does X relate to Y" architecture questions — it's a standing knowledge graph of this repo, cheaper than re-exploring.
- Before scaffolding anything, use the `writing-plans` skill (superpowers) to turn the spec section into a concrete plan — `scaffold-component` lays out folders, it doesn't replace planning. For any *new* architectural decision not already resolved in `Gap_Register_v2.txt` (a routing-model choice, a caching strategy), run `devils-advocate` (adversaria) against it before it becomes a locked entry in Non-negotiables above.
- Scaffolding a new platform component (Phase 1–5 or the addendum's C18–C23): use the `scaffold-component` skill — it lays out the 4-layer folders and stub port/adapter per Engineering Standards.
- Review pipeline, in order, once a component has code: `code-simplifier` (clarity) → bundled `code-review` skill (bugs/security on the diff) → `layer-reviewer` subagent (layering, banned constructs, naming) → `compliance-reviewer` subagent, only if the change touches personal data, memory, retrieval, or logging (crypto-shred usage, execution-log fields, tenant isolation) → the `code-review` *plugin*'s `/code-review` as the final gate before merge (PR-only, posts via `gh`, fixed 5-agent pipeline — don't confuse it with the bundled skill of the same name, see `.research/Plugin_and_MCP_Reference.md` §3 for the full collision list). Before claiming any of this passed, run `verification-before-completion` (superpowers) rather than asserting it.
- Library docs: `bun-docs`/`react-router`/`typescript-7` skills win for their ecosystems (dedicated, higher-fidelity local caches, offline-survivable); reach for `context7` only for a library none of those three cover.

## Definition of done (per plan v2, §10)

All 17 components + F1–F3 deployed and passing their eval gate; idempotency/auth verified under chaos testing; workflow replay verified across a deployment boundary; cost dashboard reconciles to zero variance for two billing cycles; sandbox escape review signed off; constraint pinning verified to survive compaction; guardrail FP/FN rates measured; prompt rollback rehearsed under 60s; Article 50 + logging retention signed off by Legal.
