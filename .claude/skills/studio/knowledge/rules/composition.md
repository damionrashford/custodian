# Composition — grid, spacing, alignment, hierarchy

Load when: laying out a page, screen, or component. STEP 5 (Skeleton) in SKILL.md.

## Decision tree

1. **Pick a base unit.** 4px (modern UI default) or 8px (Material-style, more breathing room). Use only multiples. Cite: Wathan & Schoger, *Refactoring UI* — spacing-scale chapter.
2. **Pick a grid.** 12-col for desktop product UI; 8-col for narrower marketing; 4-col for mobile. Stick to one.
3. **Pick a max-width.** 1280 / 1440 / 1600 — commit to one. Centered, with a content sub-max around 720–880 for reading.
4. **Establish hierarchy in three dimensions** — never one (see R1).

## Rules

### R1. Hierarchy uses ≥ 3 dimensions

A primary action that's only larger isn't hierarchical — it's just bigger. Stack at least three:
- **Size** (e.g. 14 → 18 → 32 type, or button height 36 → 44)
- **Weight** (400 → 500 → 700)
- **Color/contrast** (muted → foreground → accent)
- **Position** (below the fold → above; lower-right → upper-left)
- **Surrounding negative space** (cramped → roomy)

Cite: Wathan & Schoger, *Refactoring UI* — hierarchy chapters. Lidwell et al., *Universal Principles of Design* — "Hierarchy" entry.

### R2. One primary action per view

Exactly one filled, brand-color button per view. Everything else is outlined / ghost / link.

If the user resists ("but we need 2 CTAs"), redesign — one is your primary, the other becomes a secondary or moves to a different screen.

Cite: Wathan & Schoger, *Refactoring UI* — designing buttons.

### R3. Alignment is a contract

Every element snaps to a column edge, gutter line, or baseline grid. If you can draw a vertical line through 3+ elements, that line is intentional.

- Left-align body copy under 80ch.
- Center-align only headlines under 6 words.
- Right-align numerics in tables (tabular figures).
- Never center long body paragraphs (jagged left edge wrecks scanning).

Cite: Müller-Brockmann, *Grid Systems in Graphic Design* — modular grid construction. Lupton, *Thinking with Type* — alignment.

### R4. Spacing scale, not arbitrary

Use the **named studio scale** from [`layout.md`](layout.md) § The spacing scale (`--space-3xs` 2px … `--space-4xl` 144px, 4pt base). Never raw values.

Inside a component: `--space-2xs`–`--space-sm` (4–12px). Between components: `--space-lg`–`--space-xl` (24–40px). Between sections: `--space-2xl`–`--space-4xl` (64–144px).

If you find yourself typing `padding: 13px`, you've broken the scale — pick `--space-sm` (12) or `--space-md` (16).

Cite: Wathan & Schoger, *Refactoring UI* — spacing scale.

### R5. Negative space is content

Every screen needs at least one breath. Generous margins above the primary action signal importance more than the button color does.

Anti-pattern: the "wall of UI" where every pixel is occupied. Cite: Lidwell et al., *Universal Principles of Design* — signal-to-noise; whitespace.

### R6. Group by proximity, separate by space (not lines)

If two items belong together, put them close (gestalt proximity). Don't add a divider line — it's noise. Reserve dividers for true semantic boundaries.

Cite: Lupton, *Thinking with Type* — gestalt. Weinschenk, *100 Things* — gestalt grouping.

### R7. Lead the eye with a Z or F path

- Marketing / hero: Z-pattern (top-left → top-right → diagonal → bottom-right CTA).
- Content / dashboard: F-pattern (top headline → second scan-line → vertical down the left).
- Single-task form: vertical I (one column, eye drops down).

Place the primary CTA at the natural stop of the path. Cite: Weinschenk, *100 Things* — visual scanning.

### R8. The 60-30-10 weight rule

For any view: 60% dominant surface, 30% supporting surface, 10% accent/CTA. If you eye-balled it and the accent feels >15%, your hierarchy is breaking.

Cite: Wathan & Schoger, *Refactoring UI* — when in doubt, use black and white plus accent.

## Pre-ship composition checklist

- [ ] Exactly ONE primary action visible
- [ ] All padding/margin values are on the 4px (or 8px) scale
- [ ] Every element aligns to a column edge or baseline
- [ ] At least three hierarchy dimensions on the primary action
- [ ] One region of intentional empty space, not "leftover" space
- [ ] ≤5 type sizes on the page; ≤3 within this section/view
- [ ] No dividers used for purely visual grouping
- [ ] Eye-path through screen is traceable in 1 try

## Drill-deeper queries

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui "hierarchy"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui "spacing"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book grid-systems "module"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book universal-principles "alignment"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts "negative space whitespace"
```
