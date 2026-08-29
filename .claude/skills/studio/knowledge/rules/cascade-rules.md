# Cascade rules

Load when: BEFORE STEP E-1 (edit) and BEFORE running `derive-states.ts` to know what cascades.

## What derives from what

When a primary token changes, these derived tokens must be recomputed (handled by `derive-states.ts`):

### Color cascade

For every `role: "primary" | "accent" | "destructive" | "success"` color, derive:

| Derived | OKLCH transform | Rationale |
|---|---|---|
| `<role>-hover` | `L -= 0.04`, `C unchanged`, `H unchanged` | Darker on hover (light mode); for dark mode, `L += 0.04` |
| `<role>-active` | `L -= 0.08`, `C unchanged`, `H unchanged` | Even darker on active press |
| `<role>-focus` | `L unchanged`, generate a focus-ring color = `<role>` at 40% alpha | Focus ring needs to remain visible on the role color |
| `<role>-disabled` | `L unchanged`, `C *= 0.3` | Desaturated, not greyed |
| `<role>-fg` | text color on top of the role color — pick `bg` or `fg` whichever has higher contrast | Ensures readable text on the color |

Light-mode delta: subtract L for darker. Dark-mode delta: add L for lighter. `derive-states.ts` checks `state.color.mode` to choose direction.

### Typography cascade

When the type scale ratio changes, derive:

| Derived | Computation |
|---|---|
| `size-base` | unchanged anchor |
| `size-sm` | `size-base ÷ ratio` |
| `size-lg` | `size-base × ratio` |
| `size-xl` | `size-base × ratio²` |
| `size-2xl` | `size-base × ratio³` |
| `size-3xl` | `size-base × ratio⁴` |

Default ratios: 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618.

Line-height table (independent of ratio):
- `body` 1.5–1.625
- `ui` 1.2
- `button` 1.0
- `headline` 1.05–1.15
- `code` 1.5

### Spacing cascade

When `base_unit` changes (4 → 8 or vice versa):
- All spacing tokens get re-emitted as multiples of the new base
- Rounding: nearest multiple
- Surface any token that doesn't cleanly land on a multiple (rare; would indicate a non-standard input)

### Radius cascade

`radius-button` MUST equal `radius-input` (UI consistency). If user edits one, derive-states updates the other and surfaces a notice.

Nested radius rule: `radius-child < radius-parent − padding-between`. Validate the parent radius ≥ child radius + inner padding rule visually; no flag needed.

### Shadow cascade

3-tier shadow scale (sm / md / lg). When user edits sm, derive-states proportionally scales md and lg:
- md = sm with `offset-y × 2`, `blur × 2`
- lg = sm with `offset-y × 4`, `blur × 4`, `spread × 2`

User can override per-tier via `--no-cascade` on derive-states.

### Motion cascade

Duration table is fixed per design HARDLINEs:
- hover 150ms
- press 100ms
- tooltip 200ms
- modal 250–350ms
- page 300–500ms

No derivation needed — these are absolute values.

Easing:
- enter: `cubic-bezier(0, 0, 0.2, 1)` (ease-out)
- exit: `cubic-bezier(0.4, 0, 1, 1)` (ease-in)
- exit MUST be faster than enter (default ratio 0.75)

## When `derive-states.ts` runs

After every:
- merge (new tokens land, derivations refresh)
- STEP E-1 (edit — single token changed, only its cascade refreshes)
- extract (new draft — derivations only run when the draft is merged into design.json)

NOT after:
- `from-screenshot` or `from-moodboard` drafts (they're drafts, not the canonical brand)

## In-place vs new

Default: `derive-states.ts --in-place` mutates `design/design.json` directly. Atomic write (temp file → rename).

Alternative: `derive-states.ts --output <path>` writes to a new file for review. Useful when the user wants to compare derived vs current.

## What contrast-check enforces after cascade

`contrast-check.ts --level AA` validates every required pair:
- `fg` on `bg` (body text)
- `fg-muted` on `bg` (secondary text)
- `<role>-fg` on `<role>` (text-on-button-color)
- `<role>-fg` on `<role>-hover` (text on hover state)
- `<role>-fg` on `<role>-active` (text on active state)
- `border` on `bg` (border visibility — 3:1 minimum)
- `ring` on `bg` (focus ring visibility — 3:1 minimum)

Reports failures with achieved ratio + required minimum. Does NOT auto-correct.
