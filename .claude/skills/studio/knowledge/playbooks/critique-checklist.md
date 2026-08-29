# Critique checklist — pre-ship taste filter

Load when: about to declare a design "done", before sending to the user, OR when the user asks for a design review of an existing UI. DESIGN STEP 8 in SKILL.md — the non-negotiable final pass. Runs alongside the 71-gate slop test; where a check overlaps a gate, the gate's threshold is authoritative and the numbers below match it.

This is the senior staff filter. Every check is binary: pass or fail. Failed checks need a fix or a documented waiver.

## The 23-point check

### Composition (5 checks)

1. **One primary action.** Exactly one filled brand-color button per view. Everything else: outlined, ghost, link.
2. **Hierarchy in 3+ dimensions.** Size + weight + color (or position) — not just size.
3. **Spacing scale respected.** No off-scale values like `padding: 13px`. Every space is from the 4px or 8px scale.
4. **Alignment is visible.** Trace 3+ elements to one vertical or horizontal line. That line is intentional.
5. **Negative space earned.** At least one region of intentional emptiness, not "leftover" space.

Cite: Wathan & Schoger, *Refactoring UI* — visual hierarchy, spacing, alignment.

### Typography (4 checks)

6. **Display font ≠ Inter / Roboto / Arial / system-ui.** No generic sans for headlines.
7. **Type-size budget.** ≤ 5 text sizes on the page, ≤ 3 within any one section or component. Use weight + color for further differentiation (matches typography.md).
8. **Body measure 50–75 characters.** Long-form text capped at 65ch / 75ch.
9. **Smart punctuation.** Curly quotes, real em-dashes (—), real ellipses (…).

Cite: Lupton, *Thinking with Type*; Butterick, *Practical Typography*.

### Color (4 checks)

10. **WCAG AA passes.** Body text ≥ 4.5:1, large text ≥ 3:1, UI elements ≥ 3:1 against background.
11. **No pure #000 / #FFF.** Off-black for dark mode, paper-white for light mode. *Genre exception (slop gate 8): modern-minimal may use pure #FFF paper — the Stripe / ElevenLabs school.*
12. **Information not encoded by color alone.** Red/green pairings have icon or shape backup.
13. **Accent budget.** Default ~5% of any viewport; >10% is a hard fail (matches slop gate 25). 60/30/10 distribution roughly holds. *Atmospheric exception: background blooms 20–30%, background-only.*

Cite: Yablonski, *Laws of UX* — accessibility; Wathan & Schoger, *Refactoring UI* — color use.

### Interaction (4 checks)

14. **All 9 states defined** for every interactive element: rest, hover, focus-visible, active, disabled, loading, selected, empty, error.
15. **`:focus-visible` ring is high-contrast and present.** No `outline: none` without replacement.
16. **Touch targets ≥ 44×44px** (or expanded hit area via padding).
17. **`prefers-reduced-motion` honored.** Animations reduce to opacity-only or none.

Cite: Pickering, *Inclusive Components*; Yablonski, *Laws of UX* — Fitts's Law.

### Copy & content (3 checks)

18. **Real content.** No "Lorem ipsum", no "John Doe", no `[Placeholder]`. Every visible string is final-quality.
19. **Buttons are verbs.** "Send invite" not "Submit". "Got it" not "OK".
20. **Empty / error / loading states all have copy.** Not "Error" — name + cause + fix.

Cite: Krug, *Don't Make Me Think* — labels; Norman, *Design of Everyday Things* — error design.

### The taste filter (2 checks)

21. **The Lütke test.** Would Tobi Lütke ship this? Is anything *almost* good — call it out. Anti-pattern: defaulting to standard SaaS patterns "because it's expected". Distinguish on purpose.

22. **The Jobs test.** Read every detail: corner radius, button height, line-height, shadow depth, micro-interaction timing. Is any single one of them "fine"? "Fine" is the enemy of great. Either decide and commit, or admit you don't have an opinion yet.

### Thesis coherence (1 check)

23. **Does the design have a point of view, and did it keep it off the page?** Two parts, both must pass (maps to slop-test gates 70–71):
    - **Driven, not defaulted.** Of the 8 major decisions (genre, macrostructure, theme, color, type, skeleton, motion, copy), can ≥6 of 8 be traced to `state.thesis_position` rather than the catalog default? If >2 are unmoored, fail and name which STEPs to re-run (matches slop gate 70).
    - **Constraint, not manifesto.** Does the shipped copy express the thesis as an observable user benefit and *never* as philosophy ("we refuse the tyranny of…", "transparency-first")? If the position is announced rather than felt, fail.

Cite: `../rules/thesis.md` T4/T5/T6; the Lütke/Jobs filter above.

## Process

1. Run all 23 in order.
2. For each fail: choose one of:
   - **Fix** — write the change, re-run the check.
   - **Waive (with reason)** — document why this design intentionally breaks the rule. Add to the "Open decisions" section.
   - **Defer** — flag for next iteration; note in the output.
3. Count fixes/waivers/defers. If more than 3 waivers, the design likely has the wrong shape — start over from DESIGN STEP 2 (genre / macrostructure / theme) in SKILL.md.

## After the 23 — the "would this surprise me?" pass

Look at the design as if you'd never seen it. Ask:
- Is there ONE thing here that's *unforgettable*? If everything is competent, nothing is memorable.
- If a user described this to a friend, what would they say? "Looks clean" = generic. "Has these wild ___" = differentiated.
- What did I almost cut and put back? That's usually the keep. What did I leave because it was easy? That's usually the cut.

Cite: Anthropic *frontend-design* — distinct aesthetic direction, intentionality.

## Output format

After running the checklist, include in the response:

```
## Critique pass — 23 checks

Composition: 5/5
Typography: 4/4
Color: 4/4
Interaction: 4/4
Copy: 3/3
Taste: 2/2
Thesis-coherent: yes/no (driven ≥6/8 · copy clean)

WAIVED:
  - none, OR
  - <check number>: <reason>

DEFERRED:
  - none, OR
  - <check number>: <reason and what's needed to close>
```

If anything is waived or deferred, surface it before declaring the design ready.

## Drill-deeper queries

When a check fails and you need rationale:
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --mode hybrid "<the failed-check topic>"
```
