# Depth & shape — elevation, shadow, corners, borders

Load when: designing cards, modals, buttons, inputs, or any surface that needs to communicate depth or hierarchy through shape. STEP 6 (Depth + motion) in SKILL.md.

## Decision tree

1. **Pick ONE depth language** for the entire design. Don't mix:
   - **Flat** — no shadows, 1px borders only. Depth from surface color shifts.
   - **Elevated** — 3-tier shadow scale (sm, md, lg). No borders on shadowed surfaces.
   - **Layered / glass** — backdrop-blur + low-opacity surfaces. Used for floating elements over imagery.
2. **Pick a corner radius scale** (0 / 2 / 4 / 8 / 12 / 16 / full). Stick to 4–5 values.
3. **Borders or shadows — not both** on the same element. Pick one.

## Rules

### R1. Flat ≠ no hierarchy

Flat depth uses surface contrast: page bg `#0B1226` → card bg `#141B2E` → input bg `#1A2238`. Each step is a 4–8% lightness shift in the same hue family.

Anti-pattern: flat design where everything is the same color — looks broken, not minimal.

Cite: Wathan & Schoger, *Refactoring UI* — depth via color steps.

### R2. Shadow physics — directional, soft, multi-layered

A real shadow has:
- Subtle ambient (always present): `0 1px 2px oklch(20% 0.01 <hue> / 0.04)`
- Directional (from light source above): `0 8px 24px oklch(20% 0.02 <hue> / 0.08)`
- Larger spread for more elevation: `0 24px 64px oklch(20% 0.02 <hue> / 0.12)`

Combine both layers:
```css
box-shadow:
  0 1px 2px oklch(20% 0.01 250 / 0.04),
  0 8px 24px oklch(20% 0.02 250 / 0.08);
```

A single `box-shadow: 0 4px 8px rgba(0,0,0,0.2)` reads as 2014 Material — too literal, too uniform. (This layered-shadow system applies to the **elevated** depth language; flat-language pages use hairlines instead — see layout.md § Depth.)

Cite: Wathan & Schoger, *Refactoring UI* — depth and shadows. Lidwell et al., *Universal Principles of Design* — Shadow.

### R3. Shadow color is not black

For dark UI: use the page's deepest color or a brand-tinted near-black. For light UI: use a desaturated brand color at very low opacity.

```css
/* Light mode, blue brand */
--shadow-color: oklch(20% 0.03 250);
box-shadow: 0 8px 24px oklch(from var(--shadow-color) l c h / 0.08);
```

Black `#000` at any opacity reads dirty against colored backgrounds.

### R4. Corner radius — pick a scale, derive everything

| Scale | sm | md (base) | lg | xl | full |
|---|---|---|---|---|---|
| Sharp | 0 | 2 | 4 | 6 | – |
| Default | 4 | 8 | 12 | 16 | 9999 |
| Soft | 8 | 12 | 16 | 24 | 9999 |
| Pillowy | 12 | 20 | 28 | 40 | 9999 |

Rules within a scale:
- Buttons + inputs share radius (md).
- Cards use md or lg, never sm.
- Modals use lg.
- Avatars + pills use full.
- The same value applied across all corners — mixed-radius elements (e.g. radius-top only) for tabs and segmented controls only.

Cite: Wathan & Schoger, *Refactoring UI* — rounded corners as identity signal.

### R5. Nested radius — child radius is smaller than parent

If a card has `border-radius: 16` and contains a button with the same `16`, the button looks pasted on. The button's radius should be ≤ parent radius − padding. Rule of thumb: child radius = parent radius − inner padding, floored at the next step in the scale.

Cite: Wathan & Schoger, *Refactoring UI* — concentric corner radius.

### R6. Borders are commitments

`border: 1px solid` between cards on a flat design is fine. But 1px borders next to drop shadows = visual noise. Pick one.

- Flat language → 1px borders, no shadows
- Elevated language → shadows, no borders (except inputs)
- Borders should be 8–15% mix of foreground into background (not pure gray)

Cite: Wathan & Schoger, *Refactoring UI* — borders subtle. Lidwell et al., *Universal Principles of Design* — boundary.

### R7. The 3-tier shadow scale

```
shadow-sm — barely-there (inputs at rest, default cards)
  0 1px 2px oklch(<tint> / 0.04)

shadow-md — cards on hover, popovers
  0 1px 2px oklch(<tint> / 0.04), 0 4px 12px oklch(<tint> / 0.08)

shadow-lg — modals, dropdowns, floating action buttons
  0 2px 4px oklch(<tint> / 0.06), 0 16px 32px oklch(<tint> / 0.12)
```

Larger isn't always better — `shadow-2xl` rarely earned, reserve for app-launchers or hero badges.

Cite: Frost, *Atomic Design* — token scales.

### R8. Inset shadow = pressed

Active / pressed buttons use an inset shadow instead of a translation:
```css
&:active {
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.12);
  transform: scale(0.99);
}
```

Combined with the 100ms duration from `motion-interaction.md`, the press feels physical.

### R9. Glass / backdrop-blur — for ONE layer, max

Glass (`backdrop-filter: blur(12px); background: rgba(255,255,255,0.7);`) is for one floating layer above imagery — navigation, command palette, modal overlay.

Don't glass everything. Two glass layers stacked = soup. Cite: Apple HIG — translucency principles.

### R10. Elevation = priority

Higher elevation = more importance / more recent. Use shadow to communicate which surface is in the user's "attention zone":

```
Page background (z=0)
Card (z=1, shadow-sm)
Card on hover (z=2, shadow-md)
Modal backdrop dim (z=8, fixed)
Modal panel (z=9, shadow-lg)
Toast (z=10, shadow-lg + offset)
```

Modals dim everything else — the user's only valid action is in the modal. Cite: Cooper et al., *About Face* — modal interruption pattern.

## Pre-ship depth-shape checklist

- [ ] One depth language (flat / elevated / glass) — not mixed
- [ ] Shadows are layered (≥ 2 box-shadow declarations)
- [ ] Shadow color is brand-tinted, not pure black
- [ ] Corner radius scale committed; all values from the scale
- [ ] Nested radius is smaller than parent radius
- [ ] No element has BOTH border and shadow
- [ ] Buttons + inputs share corner radius
- [ ] Pressed state uses inset shadow, not just darken
- [ ] Glass layer used at most once on the screen
- [ ] Elevation order matches priority order

## Drill-deeper queries

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui "depth shadow"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui "border radius corner"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book atomic-design "design tokens"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book universal-principles "shape boundary"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts "elevation hierarchy"
```
