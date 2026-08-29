---
name: studio
description: >
  Design system skill. Build pages, components, and full UIs from an idea, a URL study, a screenshot, or a mood board. Extract design tokens from URL (fast CSS or JS-rendered), screenshot, or mood board. Merge drafts into a canonical design.json with WCAG contrast checking and state derivation. Edit, export, drift-check. Anti-slop: 21 macrostructures, 4 genres, 22 catalog themes or custom OKLCH, 71-gate slop test, thesis-driven decisions, library-grounded critique. Verbs: default design, audit, redesign, study. Use when the user says "design a", "build a page", "design this component", "extract design from", "reverse-engineer", "get tokens from", "merge drafts", "change token", "export tokens", "drift check", "did the site change", "critique this", "studio audit", "studio redesign", "studio study".
argument-hint: "[verb] [target] [args]"
allowed-tools: Read Write Edit Glob Grep Bash(bun *) Bash(uv *) Bash(ls *) Bash(mkdir *) Bash(curl *) Bash(find *) Bash(mv *) Bash(jq *) Bash(echo *) Bash(test *) Agent AskUserQuestion WebFetch
---

## Required tool calls (do not skip)

Every design turn MUST use, in order:

1. **`scripts/library/search.ts`** — ≥1 hybrid search per major decision (STEPs 1,3,4,5,6,7 + critique). Hybrid fuses BM25 + semantic and covers BOTH the book corpus and the studio rules (all embedded). Always pass `--cite .studio/citations.jsonl` so hits auto-collect into citations — no manual transcription. Folded into `state.citations` at emit. Scope with `--domain <name>` (a `books/` subdirectory or `rules`) when a decision is domain-specific.
2. **THESIS** — derive at STEP 1 (`knowledge/rules/thesis.md`); every later DECIDE serves it; audited at STEP 8.
3. **`scripts/design/validate.ts`** — runs after every draft, merge, or token edit. Exit 0 required.
4. **`scripts/design/derive-states.ts` → `contrast-check.ts` → `validate.ts`** — the cascade. Runs after every merge or edit. All three, in order.
5. **`~/.claude/skills/cdp-headless/scripts/screenshot.ts`** — runs after every artifact emit. The skill has eyes; use them.

If any of these is skipped, the turn is invalid. Restart the step.

---

## Invariants

- **Bun required.** If `bun: command not found` → `curl -fsSL https://bun.sh/install | bash`, restart shell, stop.
- **OKLCH only** for color tokens. No hex in design.json.
- **Provenance + confidence** stamped on every token. No exceptions.
- **`state` accumulates** across the full flow. Never reset mid-run.
- **Citations stay internal.** `state.citations` never surfaces to the user.
- **`--rendered` extraction is opt-in.** It drives the cdp-headless skill's Chromium singleton — ask before the first rendered run in a session.
- **No fabricated content** — no invented stats, testimonials, logos, counts.

---

## Output layout (one standard, no exceptions)

Everything studio writes lands in exactly two places, both relative to the **project root** (cwd where the user invoked studio — never inside the skill directory):

| Path | Contents | Git |
|---|---|---|
| `design/` | The canonical token store: `design.json`, `DESIGN.md`, `.design-version`, `drafts/`, `reports/` | committed (drafts/ + reports/ + `.merge.lock` gitignored by init) |
| `.studio/` | All runtime state: `runs/<slug>/<ISO>/` (every emitted artifact: `state.json`, `decisions.md`, `tokens.css`, `page.html` or `sample.tsx`, `preview*.png`, state/mobile screenshots), `log.json` (rotation log, last 20), `citations.jsonl` (transient, deleted at emit) | gitignored entirely |

Nothing else. No `.work/`, no artifacts at project root, no output inside `${CLAUDE_SKILL_DIR}`. When the user asks to keep an artifact permanently, copy it out of `.studio/runs/` to wherever they name — the run dir stays the immutable record.

---

## DESIGN STORE (token persistence)

Enter ONLY when the user asks to extract tokens (URL / screenshot / mood board), seed from an existing `design.json`, merge drafts, edit a token, export, or drift-check. Otherwise skip straight to DESIGN STEPS.

Full procedures (init, extract, merge, edit, export, drift) live in [`knowledge/rules/design-store-reference.md`](knowledge/rules/design-store-reference.md). Read it when this section applies.

**Init** (when seeding/extracting): `bun ${CLAUDE_SKILL_DIR}/scripts/design/init.ts --dir design` → write `state.design_dir`.

**Cascade — MANDATORY after every merge or token edit** (also the STEP 9 gate):
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/derive-states.ts --brand design/design.json --in-place
bun ${CLAUDE_SKILL_DIR}/scripts/design/contrast-check.ts --brand design/design.json --level AA
bun ${CLAUDE_SKILL_DIR}/scripts/design/validate.ts --brand design/design.json
```
If contrast fails: stop, report pair + ratio + minimum. Never auto-correct.

---

## DESIGN (9 steps)

### Entry gate

| Condition | Action |
|---|---|
| `design/design.json` exists | Run `validate.ts --brand design/design.json`. If invalid → repair via Edit step. |
| User gives URL or screenshot | Run extract → merge into design.json → continue with seeded tokens. |
| Nothing | "No locked design system found — designing fresh." Do NOT block. |

If user attaches image/URL without a verb: ask "Should I `study` this, or use it as reference for a fresh design?"

### Pre-flight scan
Before any code: scan for font stack, palette, motion lib, spacing scale, framework. Emit once:
```
Pre-flight: Font: <x> · Palette: <x> · Motion: <x> · Framework: <x>
Will preserve: <list>. Will introduce: <list>.
```
If `design.md` exists at project root: read it fully, all picks defer to it.

### Verb routing

| Invocation | Action |
|---|---|
| *(default)* | STEP 1 below |
| `studio audit <target>` | Load `knowledge/playbooks/verbs/audit.md` |
| `studio redesign <target>` | Load `knowledge/playbooks/verbs/redesign.md` |
| `studio study <URL or image>` | Load `knowledge/playbooks/study.md` |

### Component scope (two signals → route here)
Signals: brief names a single element, ≤30 words on one element, "just the X" / "only the Y".
Keeps: pre-flight, **micro-thesis**, genre, theme, 2+1 font rule, 9 interaction states.
Skips: macrostructure, nav/footer, hero enrichment, multi-section structure, full tension/position derivation.
Micro-thesis (lighter than STEP 1): one *job* + one *refusal* (thesis.md "Component micro-thesis"), propagated into the 9 states — the refusal must be visible in at least one state.
Emits: component artifact + `<Name>.preview.html` (9-state demo stacked + labelled).

---

### STEP 1 — Frame
Load `knowledge/playbooks/research-flow.md`. Ask the user: audience, use case, tone. If "go ahead" → infer and state picks in one sentence.

Search with a domain filter keyed to the audience so foundational books surface (not crowded out): behavioral/consumer → `--domain psychology-behavior`; B2B/developer → `--domain ux-fundamentals`. Pass `--cite` on every search this run so citations auto-collect (see Required tool calls).
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode hybrid "<jtbd keyword>" --limit 3 --cite .studio/citations.jsonl
```
Assert: JTBD has no UI nouns. Persona has 5 lines. Anti-user is specific.
Write: `state.jtbd`, `state.persona`, `state.anti_user`, `state.friction`.

**Derive the THESIS** (the spine — every later pick serves it). Read `knowledge/rules/thesis.md` (by path — it's the spine, always loaded). Produce:
- **Tension** — the real friction, reframed as human outcome, zero UI nouns (≤2 sentences).
- **Position + refusal** — "Argues that ___. Refuses ___." A position with no refusal is a slogan.
- **Tone** — exactly one of editorial/brutalist/soft/technical/luxury/playful/austere.

Assert: tension has no UI nouns; thesis has both a claim and a named refusal; maps to one tone. The thesis is a design constraint — it must NEVER appear in shipped copy as a manifesto (thesis.md T5).
Write: `state.thesis_tension`, `state.thesis_position`, `state.thesis_refusals`.

### STEP 2 — Genre + macrostructure + theme

| Signals | Load |
|---|---|
| AI, generative, music, video, dark, immersive | `knowledge/playbooks/genres/atmospheric.md` |
| SaaS, enterprise, API, B2B, developer | `knowledge/playbooks/genres/modern-minimal.md` |
| Consumer, casual, friendly, onboarding | `knowledge/playbooks/genres/playful.md` |
| Default | `knowledge/playbooks/genres/editorial.md` |

Macrostructure: read `knowledge/playbooks/macrostructures.md` (index). Pick one. Load only the per-pick file. Must differ from last 3 in `.studio/log.json`. Specimen is never the default.

Theme: pick from the 22-name catalog (Specimen · Atelier · Brutal · Salon · Newsprint · Linen · Studio · Manifesto · Terminal · Midnight · Almanac · Garden · Quiet · Riso · Sport · Bloom · Coral · Violet · Aurora · Halo · Plume · Editorial) or custom OKLCH. Catalog is default. **Read the picked theme's definition in `knowledge/rules/themes.md`** — it carries the theme's OKLCH seeds, font pairing, depth/radius/motion posture, and genre membership; seed tokens from there, never improvise them (slop gate 58). If `design.json` exists with `confidence_global ≥ 0.6`, seed theme from its tokens instead.

State picks before writing code: "Genre: X. Macrostructure: Y. Theme: Z. Differs from last on: <axes>."

Assert (thesis): genre voice matches the tone `state.thesis_position` implies; the macrostructure's reading order *argues* the thesis rather than just displaying content; theme temperature/saturation signals the position. If any pick is the catalog default rather than thesis-driven, say why or re-pick (thesis.md T4, T6).

Load nav + footer archetypes from `knowledge/playbooks/component-cookbook.md` (per-pick files only). Default away from N1 (wordmark + 4 links) and Ft3 (4-column link grid).
Write: `state.genre`, `state.macro`, `state.theme`, `state.nav`, `state.footer`.

### STEP 3 — Color
Load `knowledge/rules/color.md`. Seed from `design.json tokens.color` if present.
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode hybrid "color contrast saturation" --limit 3 --cite .studio/citations.jsonl
```
Mode (dark/light) → paper → ink → accent → derived. OKLCH only.
Assert: body ≥4.5:1, large ≥3:1, no pure black/white, accent ≤10%, temperature consistent.
Assert (thesis): temperature + accent signal `state.thesis_position` (warm = openness/trust; cool = precision; desaturated = restraint). A "constraint/restraint" thesis pulls accent ≤5%.
Write: `state.color`.

### STEP 4 — Typography
Load `knowledge/rules/typography.md`. Seed display + body from `design.json tokens.typography` if present.
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode hybrid "typographic scale hierarchy" --limit 3 --cite .studio/citations.jsonl
```
Max 3 families (display + body + 1 outlier ≤2 slots). Scale ratio: 1.25 / 1.333 / 1.414 / 1.5 / 1.618.
Assert: ≤3 families, outlier ≤2 slots, ≤5 sizes per page.
Assert (thesis): display voice + scale ratio carry `state.thesis_position` (tight ratio = restraint; wide = drama; italic serif = opinionated/literary).
Write: `state.type`.

### STEP 5 — Skeleton
Load `knowledge/rules/composition.md`. If layout feels safe/AI-default also load `knowledge/rules/layout.md`.
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode hybrid "grid spacing baseline hierarchy" --limit 3 --cite .studio/citations.jsonl
```
Decide: grid (12/8/4), base unit (4 or 8px), max-width, primary-action position, hierarchy (≥3 of size/weight/color/position/space).
Assert: exactly 1 primary action per view, all padding/margin = N × base unit, 60-30-10 holds.
Assert (thesis): primary-action placement + visibility embody `state.thesis_position` ("refuse distraction" → one action, dominant; "user has choices" → action + escape).
Write: `state.skeleton`.

### STEP 6 — Depth + motion
Load `knowledge/rules/depth.md`, `knowledge/rules/motion.md`. Seed motion from `design.json tokens.motion` if present.
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode hybrid "elevation shadow motion interaction states" --limit 3 --cite .studio/citations.jsonl
```
Depth: one language (flat/elevated/glass), radius scale, shadow scale. No element has both border AND shadow.
9 states per interactive element (rest/hover/focus-visible/active/disabled/loading/selected/empty/error). `prefers-reduced-motion` honored.
Assert: all 9 states defined, focus ring ≥2px ≥3:1.
Assert (thesis): motion language matches `state.thesis_position` (serious → flat/glass, reduced motion; playful → one celebratory beat, never gratuitous).
Write: `state.depth`, `state.motion`.

### STEP 7 — Copy
Load `knowledge/rules/copy.md`.
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode hybrid "voice tone copy labels empty states" --limit 3 --cite .studio/citations.jsonl
```
Voice card (2 traits + 2 anti-traits). Button verbs (no "Submit"/"OK"). Empty states (explain + CTA + sample). No invented stats — use `—` + grey placeholder.
Assert (thesis): the voice card's 2 traits + 2 anti-traits mirror `state.thesis_position`'s argues/refuses. Copy expresses the thesis as observable user benefit, NEVER as philosophy/manifesto (thesis.md T5 · slop-test gate 71).
Write: `state.copy`.

### STEP 8 — Critique
Load `knowledge/playbooks/delegation-patterns.md`. ALWAYS spawn:

```
Agent(
  subagent_type="Explore", model="opus", description="design critique",
  prompt="""Apply the 23-point critique at ${CLAUDE_SKILL_DIR}/knowledge/playbooks/critique-checklist.md
against this state: <state JSON>. Also run 71-gate slop test at ${CLAUDE_SKILL_DIR}/knowledge/playbooks/slop-test.md.
Active genre: <state.genre>. Thesis: <state.thesis_position> / refuses <state.thesis_refusals>.
THESIS-COHERENCE GATE: for each of the 8 major decisions (genre, macrostructure, theme, color, type,
skeleton, motion, copy), judge thesis-driven vs catalog-default. If >2 are unmoored from the thesis, FAIL
and name which STEPs to re-run (slop-test gate 70). Also check no thesis language leaked into shipped copy
as a manifesto (gate 71). For each failure: propose minimal fix.
Return JSON: { checklist, slop_gates: {passed, failed}, thesis_coherence: {driven, catalog_default, verdict}, taste: {score, reason}, summary }"""
)
```

For each FAIL: re-run the offending STEP, OR document a waiver with explicit user authorization.
Write: `state.critique`.

### STEP 9 — Emit
After critique passes:

Fold auto-collected citations into state: read `.studio/citations.jsonl`, dedupe to `state.citations`, then `rm .studio/citations.jsonl` for the next run.

Write to `.studio/runs/<slug>/<ISO>/`:
- `state.json` (full state incl. `thesis_*`; citations internal)
- `decisions.md` (plain-language rationale — explains decisions as benefits, never restates the thesis as a manifesto)
- `tokens.css` (every token used)
- `sample.tsx` or `page.html`

All code references tokens by name (`var(--token-name)`). Never inline OKLCH.

Stamp artifact CSS:
```css
/* Studio · macrostructure: <name> · genre: <genre> · theme: <theme> · tone: <tone> */
```

Append to `.studio/log.json` (trim to last 20):
```json
{ "date": "<YYYY-MM-DD>", "macrostructure": "<name>", "theme": "<name>", "brief": "<one-line>" }
```

Then run **visual iteration** (mandatory — see below).

Output to user:
```
<one-paragraph summary>

## Files
- <path> — <one line>

## Design decisions
- <plain-language reason>  (3-5 total)

## Quality
Checklist: X/23 · Slop gates: Y/71 · Thesis-coherent: <yes/no> · Taste: Z/2
WAIVED: <list or "none">

## Open decisions
1. <judgment call user might want to change>
```

---

## Visual iteration — MANDATORY after every emit

The skill has eyes via `cdp-headless`. **First run the mechanical gates, then look.** `browser-gates.ts` loads the artifact in headless Chromium and MEASURES the layout/contrast slop gates (36, 38, 43, 46-48, 54, 59, 61-63, 67, 68, plus font-count 39 and reduced-motion 29) with real Web APIs — `getComputedStyle`, `scrollWidth`, `getBoundingClientRect` — across 320/375/414/768/1280/1920 px. Exit 3 = gate failures on stderr; fix them before any screenshot judgment.

```bash
BROWSER="$HOME/.claude/skills/cdp-headless/scripts"
ARTIFACT="file://$(pwd)/.studio/runs/<slug>/<ISO>/sample.html"
OUT=".studio/runs/<slug>/<ISO>"

bun ${CLAUDE_SKILL_DIR}/scripts/design/browser-gates.ts "$ARTIFACT"   # mechanical gates FIRST — exit 0 required

bun $BROWSER/launch.ts start
bun $BROWSER/navigate.ts "$ARTIFACT" --wait=load
bun $BROWSER/screenshot.ts --full-page --output=$OUT/preview.png
```

**Read the screenshot.** Edit the artifact, then:
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/browser-gates.ts "$ARTIFACT"   # re-gate after every edit
bun $BROWSER/navigate.ts reload --wait=load
bun $BROWSER/screenshot.ts --full-page --output=$OUT/preview-v2.png
```
Repeat until gates pass AND intent matches.

**State verification** — load the 9-state demo, screenshot each:
```bash
bun $BROWSER/snapshot.ts
bun $BROWSER/dom.ts hover "button.primary"
bun $BROWSER/screenshot.ts --selector ".preview-panel" --output=$OUT/state-hover.png
bun $BROWSER/wait.ts selector ".loading" --timeout=3000
bun $BROWSER/screenshot.ts --full-page --output=$OUT/state-loading.png
```
Use `bun $BROWSER/highlight.ts show TARGET` before a screenshot to confirm targeting. Re-`snapshot.ts` after navigation — refs invalidate on DOM change. Never `sleep`; always `wait.ts`.

**Mobile** (when responsive in scope):
```bash
bun $BROWSER/emulate.ts device iphone15
bun $BROWSER/navigate.ts reload --wait=load
bun $BROWSER/screenshot.ts --full-page --output=$OUT/preview-mobile.png
bun $BROWSER/emulate.ts reset
```

Append all screenshots to the STEP 9 `## Files` block.

---

## Library — iterative search is mandatory

Knowledge lives at `${CLAUDE_SKILL_DIR}/knowledge/`:
- `knowledge/books/` — canonical works, **the embedded semantic corpus** (color-theory, design-systems, psychology-behavior, tech-docs, typography, ui-visual, ux-fundamentals, web-frontend). This is what `--mode semantic`/`hybrid` searches.
- `knowledge/rules/` — studio-authored rule files, **loaded by exact path per STEP** (color.md at STEP 3, etc.) AND fully searchable — section-split into per-heading pages, BM25-indexed, and semantically embedded alongside the books. Always Read the full `.md` when a STEP names it; snippets don't carry the imperatives + assert thresholds. After editing any rule `.md`, run `rules-to-json.ts` then `embed.ts` to refresh the search corpus.
- `knowledge/playbooks/` — procedural files called by exact path (do NOT search these).

Search with (hybrid/semantic/BM25 all cover books AND rules; scope with `--domain`):

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts "<query>" [--mode hybrid|bm25|semantic] [--book <id>] [--limit N]
bun ${CLAUDE_SKILL_DIR}/scripts/library/page.ts --book <id> (--page N | --from N --to N)
```

If Ollama is DOWN, semantic/hybrid auto-fall-back to BM25 (warns on stderr, exit 0) — no action needed. Never read book `*.md`/`.pdf` in full into context; use `page.ts` for a range.

Each of STEPs 1,3,4,5,6,7 has an explicit `search.ts --cite` call above; that satisfies the per-DECIDE grounding requirement. Don't re-derive the rule — just run the call the step specifies.

---

## Conditional references (load only when condition fires)

| Condition | Load |
|---|---|
| Framing any full design (STEP 1) | `knowledge/rules/thesis.md` *(the spine — not optional)* |
| Token extraction / merge / export / drift | `knowledge/rules/design-store-reference.md` |
| `studio study` verb | `knowledge/playbooks/study.md` |
| `studio audit` verb | `knowledge/playbooks/verbs/audit.md` |
| `studio redesign` verb | `knowledge/playbooks/verbs/redesign.md` |
| Custom palette named | `knowledge/rules/custom-theme.md` |
| Mobile/responsive in scope | `knowledge/rules/responsive.md` |
| Interactive elements | `knowledge/rules/microinteractions.md`, `knowledge/rules/interaction-states.md` |
| Hero enrichment tier D/E | `knowledge/rules/imagery-kit.md`, `knowledge/rules/assets.md` |
| Enrichment needs CSS art / SVG | `knowledge/rules/custom-craft.md` |
| N10 nav pick | `knowledge/rules/floating-nav.md` |
| Runnable code output | `knowledge/rules/tech-stack.md` (STEP 9 only) |
| Multi-format token exports | `knowledge/rules/export-formats.md` |
| Handoff contract | `knowledge/rules/contract.md` (STEP 9 only) |
| Auditing page structure | `knowledge/rules/structure.md` |
| Theme picked at STEP 2 | `knowledge/rules/themes.md` *(OKLCH seeds + fonts + posture for all 22 — never improvise)* |

Background quality gate (no load needed): `knowledge/rules/anti-patterns.md`.

---

## Development (working on the skill itself)

`bun test` at the skill root runs the full verification suite (154 tests): color math vs coloraide reference vectors, the end-to-end store pipeline, all 22 theme palettes' contrast targets + a snapshot guard, knowledge-corpus integrity (links, gate/check counts, md↔json sync), and search behavior. Run it after ANY change to scripts, rules, playbooks, or themes. After editing rule markdown: `bun scripts/library/rules-to-json.ts && bun scripts/library/embed.ts` (content-hash-aware — only stale corpora re-embed).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `bun: command not found` | `curl -fsSL https://bun.sh/install \| bash`, restart shell |
| `uv: command not found` / `color-math.py` fails | uv missing — the cascade's math authority needs it. Install per docs.astral.sh/uv, restart shell. |
| `extract-url.ts` exit 1 | URL unreachable. Check connectivity. Suggest `--rendered`. |
| `validate.ts` exit 2 | Schema invalid. Report first error. Offer Edit-step repair. |
| `contrast-check.ts` exit 3 | WCAG AA fail. Print pair + ratio + minimum. Ask user to tweak or waive. |
| `browser-gates.ts` exit 3 | Mechanical slop-gate failures — stderr lists gate numbers + measured details per viewport. Fix the artifact; never ship over a failing gate. |
| `merge.ts` exit 3 | Conflict (categorical disagreement or mixed units). Parse stderr, present, re-run with `--resolve <token>=<value>`. |
| Library search exit 3 | Embeddings missing. `embed.ts --book <id>` (needs Ollama) or `--mode bm25`. |
| Need to re-extract a book | Source PDFs were removed (runtime uses `.json`). `git checkout <rev> -- <book>.pdf` from history, then `extract-pdf.ts`. Re-embedding alone needs only the `.json`. |
| Ollama DOWN | `--mode bm25` for all library searches. |
| `--rendered` exit 4 | The cdp-headless browser failed to start — run `bun ~/.claude/skills/cdp-headless/scripts/launch.ts start` and read its error. |
| `dom.ts` errors "ref no longer in DOM" | DOM changed. Re-`snapshot.ts`. |
| `screenshot.ts` blank | Add `wait.ts selector` before screenshot. Never `sleep`. |