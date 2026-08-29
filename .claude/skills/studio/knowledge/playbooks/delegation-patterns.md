# Delegation patterns — Agent() spawn templates

Load when: SKILL.md STEP 8 fires (Pattern C, always), or a situation below matches. Contains the exact `Agent(...)` call template for each. Do NOT improvise spawn syntax — use these verbatim with placeholders filled.

| Pattern | Trigger | Spawn |
|---|---|---|
| A | Pure-citation query ("what does X say about Y?") | 1× Explore (sonnet) |
| B | Full design run at effort ≥ high — parallel domain pulls for STEPs 3/4/6 | 4× Explore (sonnet) in one message |
| C | **STEP 8 critique (always)** — SKILL.md's inline call IS this pattern | 1× Explore (opus) |
| D | STEP 1 with a vague brief | 1× general-purpose (opus) |
| E | STEP 9 emit with a scaffolded site, mid-write API check | 1× Explore (sonnet) |

## Agent() field reference

```
Required:
  description        Short 3–5 word label
  prompt             The full task

Optional:
  subagent_type      "Explore" | "Plan" | "general-purpose" | <custom from .claude/agents/>
  model              "sonnet" | "opus" | "haiku" — override per-fork (defaults to parent session)
  run_in_background  true → fires and notifies on completion (useful for slow forks)
  isolation          "worktree" → temp git worktree (NOT useful here — we don't edit code)
```

**Model choice per pattern** (cost / quality balance):
- Pattern A (citation lookup, single fork) → `sonnet`
- Pattern B (parallel domain pulls, 4× fork) → `sonnet` per fork
- Pattern C (critique with taste filter) → `opus`
- Pattern D (deep discovery + persona) → `opus`

**`run_in_background`**: set `true` only when the fork is expected to run >30s AND the main thread has independent work to do. For studio, this applies almost never — STEPs depend on prior state, so we wait synchronously.

## Pattern A — Citation lookup (pure research query)

**Use when:** the user's request is informational. Skip STEPs 2–9.

**Single Explore fork** — read-only, optimized for searching the library:

```
Agent(
  subagent_type="Explore",
  model="sonnet",
  description="design citation",
  prompt="""Search the studio library for: <USER_QUESTION>

Procedure:
1. Run: bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode hybrid '<query>' --limit 5
2. If hybrid is weak: retry with --mode semantic and --mode bm25
3. For best 1-2 hits, drill in with: bun ${CLAUDE_SKILL_DIR}/scripts/library/page.ts --book <id> --page <N>
4. Return JSON only:
   {
     "synthesis": "<3-sentence answer in your own words>",
     "citations": [{ "book", "title", "author", "page", "snippet" }]
   }
"""
)
```

**After return:** relay synthesis + cite each result by `<Author>, <Title>, p.<N>`.

---

## Pattern B — Parallel domain pulls (STEPs 3 color / 4 typography / 6 depth+motion, at effort ≥ high)

**Use when:** a full design run at effort `high` / `xhigh` / `max`. Spawn all 4 in ONE message — Claude Code runs them concurrently.

```
Agent(
  subagent_type="Explore",
  model="sonnet",
  description="type citations",
  prompt="""Collect typography citations for this design:
Skeleton: <state.skeleton JSON>
Aesthetic direction: <state.direction>

Run:
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book thinking-with-type 'type scale hierarchy' --limit 3
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book elements-of-typographic-style 'measure' --limit 2
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book practical-typography 'line height' --limit 2

Return JSON: { domain: 'typography', citations: [...], proposed_values: { scale_ratio, weight_pair, line_heights } }"""
)

Agent(
  subagent_type="Explore",
  model="sonnet",
  description="color citations",
  prompt="""Collect color citations for this design:
Skeleton + direction: <state JSON>
Mode (dark|light): <derived from state.direction>

Run:
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui 'color palette saturation' --limit 3
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode bm25 'WCAG contrast ratio' --limit 2
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book interaction-of-color 'simultaneous contrast' --limit 2

Return JSON: { domain: 'color', citations: [...], proposed_values: { mode, palette, temperature } }"""
)

Agent(
  subagent_type="Explore",
  model="sonnet",
  description="depth citations",
  prompt="""Collect depth/shadow citations for this design:
Aesthetic direction: <state.direction>

Run:
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui 'depth shadow' --limit 3
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui 'border radius corner' --limit 2

Return JSON: { domain: 'depth', citations: [...], proposed_values: { language, radius_scale, shadow_scale? } }"""
)

Agent(
  subagent_type="Explore",
  model="sonnet",
  description="motion citations",
  prompt="""Collect motion/state citations for this design:
Interactive elements: <list from state.skeleton>

Run:
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book inclusive-components 'focus keyboard' --limit 2
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book laws-of-ux 'doherty fitts' --limit 3
- bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book about-face 'interaction states' --limit 2

Return JSON: { domain: 'motion', citations: [...], proposed_values: { durations, easings, focus_ring_spec } }"""
)
```

**After all 4 return:** validate proposed values against each STEP's asserts (STEP 3 color, STEP 4 typography, STEP 6 depth+motion in SKILL.md). Synthesize into `state.type`, `state.color`, `state.depth`, `state.motion`. Append all citations.

**At effort `low` / `medium`**: skip Pattern B. Run STEPs 3–6 sequentially in main thread.

---

## Pattern C — Critique fork (STEP 8, always)

**Use when:** STEP 8 (always, unless subagents are unavailable). SKILL.md STEP 8 shows the canonical inline call — this pattern documents the same contract; if they ever diverge, SKILL.md wins.

```
Agent(
  subagent_type="Explore",
  model="opus",
  description="design critique",
  prompt="""Apply the 23-point critique checklist at ${CLAUDE_SKILL_DIR}/knowledge/playbooks/critique-checklist.md
against this design state:

<state JSON, all fields>

Also run the 71-gate slop test at ${CLAUDE_SKILL_DIR}/knowledge/playbooks/slop-test.md.
Active genre: <state.genre>. Thesis: <state.thesis_position> / refuses <state.thesis_refusals>.
THESIS-COHERENCE GATE: for each of the 8 major decisions (genre, macrostructure, theme, color, type,
skeleton, motion, copy), judge thesis-driven vs catalog-default. If >2 are unmoored, FAIL and name
the STEPs to re-run (gate 70). Check no thesis language leaked into shipped copy (gate 71).

For each check/gate, evaluate strictly. For any FAIL, propose the minimal fix.
You MAY run additional searches via ${CLAUDE_SKILL_DIR}/scripts/library/search.ts to verify rationale.

Return JSON only:
{
  "checklist": { "composition": {...}, "typography": {...}, "color": {...}, "interaction": {...}, "copy": {...} },
  "slop_gates": { "passed": N, "failed": [{ "id", "reason", "fix" }] },
  "thesis_coherence": { "driven": N, "catalog_default": [...], "verdict": "pass|fail" },
  "taste": {
    "score": "X/2",
    "lutke": { "pass": bool, "reason": "<one sentence>" },
    "jobs":  { "pass": bool, "reason": "<one sentence>" }
  },
  "summary": "<X/23 checks, Y/71 gates, thesis verdict, Z fixes proposed>"
}
"""
)
```

**After return:** parse into `state.critique`. If any FAILs, re-run the offending STEP with the proposed fix, or document a waiver with user authorization.

---

## Pattern D — Deep discovery (DESIGN STEP 1 when JTBD is unclear)

**Use when:** `$brief` is vague / feature-shaped. Skip the inline STEP 1 search.

```
Agent(
  subagent_type="general-purpose",
  model="opus",
  description="design discovery",
  prompt="""Run the 6-step discovery procedure in ${CLAUDE_SKILL_DIR}/knowledge/playbooks/research-flow.md
for the user's brief: '<brief>'.

Steps to execute:
1. Re-frame feature → outcome
2. 5-line persona
3. Mental model check (run: bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book laws-of-ux '<topic>' --limit 3)
4. Identify dominant friction
5. Define observable success criterion
6. Risk catalog (top 3)

Return JSON only:
{
  "jtbd": "<one sentence, no UI nouns>",
  "persona": { "role", "frequency", "sophistication", "context", "anti_goal" },
  "anti_user": "<role>",
  "friction": "cognitive|motoric|emotional",
  "success_criterion": "<observable event>",
  "risks": ["<risk1>", "<risk2>", "<risk3>"],
  "named_laws": ["<Jakob|Hick|Fitts|...>"],
  "citations": [...]
}
"""
)
```

**After return:** parse into `state.jtbd`, `state.persona`, `state.anti_user`, `state.friction`, `state.risks`. Append citations. Proceed to STEP 2.

**At effort `low`** OR when `$brief` is already outcome-shaped: skip Pattern D and run STEP 1 inline.

---

## Pattern E — Live tech-doc lookup (mid-emit verification)

**Use when:** during STEP 9 (Emit) when the run scaffolded a site and you need to verify a specific React Router API signature, a Tailwind v4 utility class, or a CSS-first `@theme` config detail before writing code. Faster + cheaper than re-loading `tech-stack.md` for one-off lookups. **Only fires when site work is active** — skip for token-only design output.

```
Agent(
  subagent_type="Explore",
  model="sonnet",
  description="tech doc lookup",
  prompt="""Look up <SPECIFIC_API_OR_UTILITY> in the live tech-docs library.

Decide which book to search:
- React Router APIs / components / hooks / framework conventions → --book react-router
- Tailwind utility classes / theme variables / CSS-first config  → --book tailwind

Run (replace QUERY with the specific term):
  bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book react-router 'QUERY' --limit 3
  OR
  bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book tailwind 'QUERY' --limit 3

If the snippet is incomplete, drill in:
  bun ${CLAUDE_SKILL_DIR}/scripts/library/page.ts --book <id> --page <N>

Return JSON only:
{
  "source": "react-router" | "tailwind",
  "api_or_class": "<the looked-up identifier>",
  "signature_or_definition": "<verbatim code/CSS from docs>",
  "usage_example": "<minimal example>",
  "notes": "<any gotchas or version constraints>",
  "citation_url": "<the live URL — pulled from page metadata>"
}
"""
)
```

**After return:** use the signature/example to write code in the artifact. Cite the URL in Design rationale if it informed a non-obvious choice.

**Do NOT use Pattern E for general design questions** (those go through STEPs 3–6 searches or Pattern A). Pattern E is only for verifying API surface area while writing code in a scaffolded project.

---

## Delegation invariants

- **Parallel forks** (Pattern B): use ONE message with multiple `Agent(...)` calls — Claude Code runs them concurrently. Sequential `Agent()` calls in separate messages waste latency.
- **Subagents lose conversation history.** Compose self-contained prompts with everything they need (state JSON, file paths via `${CLAUDE_SKILL_DIR}`).
- **Subagents return one message.** Their internal tool calls are NOT visible to the main thread — only the final string. Force structured JSON output via "Return JSON only" instructions.
- **Subagents cannot ask follow-up questions.** If the prompt is ambiguous, the subagent guesses. Compose precisely.
- **`description`** is a short label (3–5 words). `prompt` is the full task. `subagent_type` is `Explore` | `Plan` | `general-purpose` | any custom from `.claude/agents/`.
- **Citations from subagents must be parsed**, not relayed verbatim. The main thread owns the final Design rationale section.
