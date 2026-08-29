# Thesis — the position a design argues

Load when: framing any full design (STEP 1 in SKILL.md), and re-checked at STEP 8. This is the spine every other decision hangs off.

A design that passes every contrast, type, and slop gate can still be dead: locally correct, globally pointless. The fix is not more rules — it is a **position**. Before picking a genre or a palette, decide what this interface *argues for* and what it *refuses*. Then every downstream pick must serve that argument or be re-run. The thesis is a **design constraint, not shipped copy** — it never appears on the page as a manifesto (see R5).

## Decision tree

1. **Name the tension.** What real friction does this resolve? Reframe from feature to human outcome. No UI nouns.
2. **Take a position.** What does this design argue for? State it as a belief, not a tactic.
3. **Name the refusal.** What does it deliberately *not* do? A position without a refusal is a slogan.
4. **Map to a tone.** The position implies one of the seven tones (`copy.md`). If it doesn't, the position is too vague.
5. **Propagate.** Carry the thesis into every DECIDE (R4). At STEP 8, audit: thesis-driven or catalog-default?

## Rules

### T1. The tension is a friction, not a feature

One sentence. It describes what hurts, in the user's world, before the product exists. No UI nouns ("dashboard", "button", "modal"), no feature names.

| Weak (feature/UI) | Strong (friction/outcome) |
|---|---|
| "Users need a better task list." | "People can't tell real priorities from busy-work, so everything feels urgent and nothing gets finished." |
| "Add a pricing comparison table." | "Buyers fear the hidden fee — they distrust a price until they've seen what's *not* included." |
| "Improve onboarding flow." | "A new user has thirty seconds of patience and one question: will this actually save me time today?" |

Assert: tension is ≤2 sentences, contains zero UI nouns, names a human stake.

Cite: Cooper et al., *About Face* — goal-directed design (goals over tasks); Krug, *Don't Make Me Think* — the user's real question.

### T2. The thesis is a position **plus** a refusal

Format: **"This design argues that ___. It refuses ___."** The refusal is what makes it a position and not a platitude — it names the obvious default you are walking away from.

```
Argues: priorities are only meaningful when they're bounded.
Refuses: the infinite scroll of equal-weight tasks.

Argues: a price is trustworthy only when the exclusions are as loud as the number.
Refuses: the asterisk and the "contact us for pricing".

Argues: the first screen should do one useful thing before asking for anything.
Refuses: the signup wall, the tour, the empty dashboard.
```

Assert: thesis has both a positive claim and a named refusal. If you can't name what it refuses, you don't have a position yet — go back to T1.

Cite: Lidwell et al., *Universal Principles of Design* — constraints, form follows function; Norman, *Design of Everyday Things* — affordances as decisions.

### T3. The thesis implies exactly one tone

The position should land on one of the seven tones from `copy.md`: **editorial · brutalist · soft · technical · luxury · playful · austere**. If two tones fit equally, the thesis is underspecified — sharpen the refusal until one tone wins.

- "refuses ornament, argues for the plain fact" → brutalist or austere
- "argues for warmth, refuses the corporate" → soft
- "argues for craft and lineage, refuses the generic" → editorial or luxury

Assert: thesis maps to exactly one named tone, written into `state.thesis_position`.

Cite: see `copy.md` voice samples per tone — imitate the *specificity*, never the wording.

### T4. Every DECIDE serves the thesis (propagation)

The thesis is not a STEP 1 artifact you forget. Each later step gets a one-line coherence check against `state.thesis_position`:

| Step | Coherence check |
|---|---|
| 2 Genre | Genre voice matches the tone the thesis implies (T3). |
| 2 Macrostructure | The flow *argues* the thesis — the reading order makes the case — rather than merely displaying content. |
| 3 Color | Temperature + accent signal the position (warm = openness/trust; cool = precision; desaturated = restraint). A "constraint" thesis pulls accent ≤5%, below the ≤10% default. |
| 4 Type | Display voice + scale ratio carry the position (tight ratio = restraint; wide = drama; italic serif = opinionated). |
| 5 Skeleton | Primary-action placement embodies the stance ("refuse distraction" → one action; "user has choices" → action + escape). |
| 6 Depth/Motion | Motion language matches (serious → flat/reduced; playful → one celebratory beat, never gratuitous). |
| 7 Copy | Voice card's 2 traits + 2 anti-traits mirror the thesis's argues/refuses. |

Assert: at STEP 8, ≥6 of 8 decisions are traceable to the thesis (see slop-test gate 70).

Cite: Wathan & Schoger, *Refactoring UI* — hierarchy as intent; Müller-Brockmann, *Grid Systems* — structure as argument.

### T5. Anti-grandiosity — the thesis is a constraint, not a slogan

The thesis lives in `state`, not on the page. It guides what you build; it must **never** be paraphrased into shipped copy as philosophy.

| Slop (thesis leaked as manifesto) | Ship (thesis expressed as benefit) |
|---|---|
| "We refuse the tyranny of infinite possibility." | "You always see your five real priorities — nothing else." |
| "We embrace the poetry of constraint." | "One screen. One next step." |
| "Transparency-first, always." | "Every fee is on this page. No surprises at checkout." |

The test: would a user care, or is this written for designers to admire? If copy *names the philosophy* instead of an observable benefit, it fails (see `slop-test.md` gate 71).

Cite: copy.md R10 (AI-slop bans); the Lütke/Jobs taste filter in `critique-checklist.md`.

### T6. Catalog-default detection

The whole point is to escape catalog-by-default. For each major pick, you must be able to finish the sentence "I chose X *because the thesis calls for* ___." If the honest answer is "because it was the default" or "because the catalog routed there", the pick is unmoored — flag it and re-derive from the thesis.

Assert: no more than 2 of the 8 major decisions may be catalog-default; otherwise STEP 8 fails the offending steps.

## Component micro-thesis (component-scope only)

A single component doesn't make a page-level argument, but it still has an opinion. Derive a **micro-thesis**: one *job* + one *refusal*, then make all interaction states honor it.

```
Button — Job: signal the single next step. Refuses: hidden affordances, gradient-fill optics.
  → focus ring is instant and high-contrast (never faded), because the refusal forbids hidden affordance.
```

Assert: micro-thesis present; its refusal is visible in at least one interaction state.

## Worked example (full)

> **Tension:** A founder checking metrics at 7am has one question — "is anything on fire?" — and today's tools bury that under twelve equal-weight charts.
> **Thesis:** Argues that a dashboard's first job is triage, not completeness. Refuses the wall of equal charts.
> **Tone:** technical.
> **Propagation:** macrostructure = stat-led (one verdict above the fold); color = desaturated with a single alert accent; type = tabular figures, tight scale; skeleton = one primary "what's wrong" region, everything else below the fold; motion = none except the alert state; copy = "All systems normal" / "2 metrics need you", never "Welcome back!".

## Pre-derive checklist

- [ ] Tension stated, ≤2 sentences, zero UI nouns
- [ ] Thesis has a positive claim AND a named refusal
- [ ] Thesis maps to exactly one tone
- [ ] `state.thesis_tension`, `state.thesis_position`, `state.thesis_refusals` written
- [ ] Propagation plan noted for steps 2–7
- [ ] No thesis language scheduled to appear in shipped copy (T5)

## Drill-deeper queries

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book about-face "goals tasks intent"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book universal-principles "constraint form function"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui "hierarchy emphasis"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts "what makes a design memorable point of view"
```
