# Colour

Most AI-generated UI fails on colour. It picks blue. It uses pure black. It draws a gradient from purple to cyan. It leaves accents on 30% of the page. Fix all of this.

## Principles

- **OKLCH only.** Perceptually uniform; predictable lightness; consistent hue across tints. `hsl()` and `rgb()` lie about brightness.
- **One accent.** Maximum two. Everything else is neutral. The accent should occupy **3% or less** of any given viewport.
- **No pure extremes.** No `#000`, no `#fff`. Always tint with a trace of chroma toward the palette's anchor hue.
- **Tint the greys.** If your anchor hue is orange, your neutrals lean warm. If it's blue, they lean cool. A page with a warm accent and cool grey body copy looks wrong and most people can't name why.

## Palette construction

A complete Studio palette has four layers.

1. **Paper** — the base surface. `oklch(96–98% 0.005–0.015 <anchor hue>)` for light mode, `oklch(12–16% 0.008–0.015 <anchor hue>)` for dark.
2. **Ink** — the primary text. `oklch(16–22% 0.005–0.015 <anchor hue>)` for light mode, `oklch(92–96% 0.005–0.01 <anchor hue>)` for dark.
3. **Neutrals** — 5 to 9 steps between Paper and Ink, each with the anchor's chroma tint at low values (0.005–0.015).
4. **Accent** — one saturated colour with meaningful chroma (0.12–0.22). Used for links, active states, highlights, focus rings. Never as a background fill that covers more than a few percent of the surface.

Example (warm-oat anchor, hue 80):

```css
:root {
  --color-paper:    oklch(96%  0.012 80);
  --color-paper-2:  oklch(93%  0.014 80);
  --color-rule:     oklch(82%  0.010 80);
  --color-neutral:  oklch(56%  0.008 80);
  --color-muted:    oklch(40%  0.008 70);
  --color-ink:      oklch(18%  0.010 60);
  --color-accent:   #FC4C02;                   /* signal orange */
  --color-focus:    oklch(55%  0.19  55);
}
```

Example (midnight anchor, hue 40):

```css
:root {
  --color-paper:    oklch(14%  0.008 40);
  --color-paper-2:  oklch(18%  0.010 40);
  --color-rule:     oklch(30%  0.008 40);
  --color-neutral:  oklch(58%  0.008 40);
  --color-muted:    oklch(72%  0.006 40);
  --color-ink:      oklch(94%  0.006 80);
  --color-accent:   #FC4C02;
  --color-focus:    oklch(70%  0.19  55);
}
```

## Contrast

Use the APCA contrast check when you can; otherwise WCAG 2.1 ratios.

| Content | Minimum | Target |
| --- | --- | --- |
| Body text | 4.5:1 | 7:1 |
| Large text (≥ 18.66px bold or 24px) | 3:1 | 4.5:1 |
| UI component boundaries | 3:1 | 4.5:1 |
| Placeholder / helper text | 4.5:1 | 4.5:1 |

Verify with the browser devtools vision-deficiency emulator before shipping.

## Dark mode recipe

- Paper: lightness 12–18% (not `#000`).
- Ink: lightness 92–96% (not `#fff`).
- Body font-weight: reduce by 50 units (400 → 350) to compensate for the optical weight of light text on dark.
- Accent: reduce chroma by 0.02–0.04; increase lightness by 5–10%.
- Elevation: higher surfaces are *lighter*, not darker. Add ~3% lightness per level.
- Never switch the hue between modes. Keep the anchor. Only lightness and chroma move.

## Bans

- **Pure `#000000`** anywhere. Use `oklch(16% 0.01 <hue>)` or similar.
- **Pure `#ffffff`** as a base surface. Use a tinted paper. *Genre exception (slop gate 8): modern-minimal may use pure white paper; Quiet ships it (see themes.md).*
- **Flat grey** (`oklch(L 0 H)` with zero chroma). Add at least 0.005. *Genre exception (slop gate 24): modern-minimal allows zero-chroma neutrals.*
- **Purple-to-cyan gradients, purple-to-blue gradients, orange-to-pink gradients.** Every LLM picks these. Don't.
- **Accent as background fill** covering more than ~5% of any view.
- **Grey text on coloured background.** Always reads washed out.
- **Red–green pairing as the only signal.** Add an icon or pattern.
- **Alpha transparency as the definition of a colour.** If it's a named token, it's opaque. Transparency is a *modifier* for overlays and shadows, not a palette.
- **Three-colour gradients.** Two-stop gradients only. The third stop is vanity.

## Use of the accent

The accent is a highlighter, not a colour block. Reach for it to:

- Mark an active nav item.
- Draw a focus ring.
- Underline a link on hover.
- Indicate a primary CTA's border or text.
- Place a small square beside a heading as a visual anchor.

Do not fill giant buttons with it. Do not set whole sections on it. Do not use it for decorative gradients. If you feel the urge to use more, that's the slop defaulting. Use less.

---

## Color theory background


## Decision tree

1. **Mode first.** Dark or light? Pick before anything else — derivations differ.
2. **Pick the dominant.** One surface color (background) covers 60% of the screen.
3. **Pick the foreground.** One ink-color for body text on the surface. Must hit WCAG AA.
4. **Pick the primary accent.** Exactly one — used for the single primary action.
5. **Derive the rest** (muted, border, input, ring, destructive, secondary surface) from the four above.

## Rules

### R1. The 5-token palette (start here, derive everything)

```
background      surface (dominant, 60% of screen)
foreground      ink (body text)
primary         brand color for THE primary action only
accent          secondary color for badges, highlights, tags (NOT buttons)
destructive     error / delete state
```

Everything else is derived:
- `muted` = 4–8% mix of foreground into background (subtle surface)
- `muted-foreground` = 40–60% mix of foreground into background (secondary text)
- `border` = 8–15% mix (1px edges)
- `input` = same as muted or background depending on mode
- `ring` = primary at 40% opacity (focus rings)

Cite: Wathan & Schoger, *Refactoring UI* — color palette construction. Frost, *Atomic Design* — semantic tokens.

### R2. WCAG contrast — non-negotiable minimums

| Pair | Minimum | Comfortable | Use for |
|---|---|---|---|
| Body text on background | 4.5:1 | 7:1+ | Paragraphs, default UI text |
| Large text (≥18.66px @700 or ≥24px) | 3:1 | 4.5:1+ | Headlines |
| UI element vs background | 3:1 | – | Borders, icons, button outlines |
| Disabled text | (exempt) | 3:1 | Disabled buttons (still tell user why) |

Check every primary + foreground combo with a contrast checker. If primary on background fails 4.5:1 at body size, primary is decoration only — use primary-foreground (white or near-black) for actual button text.

Cite: Yablonski, *Laws of UX* — accessibility / color contrast; Lidwell et al., *Universal Principles of Design* — readability.

### R3. The 60-30-10 distribution

Dominant 60% (background), supporting 30% (muted/secondary surfaces), accent 10% (primary action + brand moments). If your screen feels noisy, the accent is over its budget.

Cite: Wathan & Schoger, *Refactoring UI* — using color sparingly.

### R4. Don't use pure black or pure white in dark/light modes

- Dark mode: `#000` is too harsh — eye strain on OLED. Use `#0A0B0E` to `#1A1A1F` for the base surface.
- Light mode: `#FFF` glares. Use `#FAFAFA` to `#F8F9FB` (paper white).
- Body text on light bg: not `#000` but `#0F172A` to `#1F2937` (cooler ink reads softer).
- Body text on dark bg: not `#FFF` but `#E5E7EB` to `#F3F4F6`.

Cite: Adams, *Designer's Dictionary of Color* — black and white as designed choices; Albers, *Interaction of Color* — perceptual softening.

### R5. Color temperature is a single decision

Either: warm-leaning palette (yellow-red-orange undertone, even in "neutral" grays) or cool-leaning (blue-green undertone). Don't mix. Cite: Albers, *Interaction of Color* — color interaction.

Test: pull all your grays into a single screen. Do they look like one family, or like a mismatch? If mismatch — recompose all from one temperature.

### R6. Semantic color mapping

Lock these meanings — never reassign:

| Semantic | Hue family | Examples |
|---|---|---|
| Success / confirmation | Green | Save complete, validated input |
| Warning / caution | Amber / yellow | Unsaved changes, rate-limit approaching |
| Error / destructive | Red | Failed action, delete confirmation |
| Info | Blue (or brand primary if blue-family) | Tooltips, neutral notices |
| Brand primary | Whatever you chose | THE primary CTA |

Anti-pattern: red for "buy now" button next to a delete button. Red means "stop / danger" globally — reserve it.

Cite: Lidwell et al., *Universal Principles of Design* — Color (semantic associations); Weinschenk, *100 Things* — color perception.

### R7. Color blindness sanity check

~8% of men have red-green color blindness. Don't encode information in red-vs-green alone — pair with an icon or shape.

- ✓ icon + green border + "Saved" label
- ✗ red dot vs green dot (deuteranopes can't distinguish)

Run a deuteranopia simulation on every screen (browser devtools → Rendering → Emulate vision deficiency).

Cite: Weinschenk, *100 Things* — peripheral vision, color blindness chapters.

### R8. Saturation distribution (Refactoring UI's key insight)

A palette of evenly-saturated colors looks amateur. Mix: 1–2 highly saturated colors (primary + accent), 5–8 muted/grayscale variations. Never paint every element at peak saturation.

Cite: Wathan & Schoger, *Refactoring UI* — saturation distribution.

### R9. Brand color from a real reference

If the user named a brand: read its profile via `bun ${CLAUDE_SKILL_DIR}/scripts/library/page.ts --book <slug> --page 1`. Pull the exact hex codes — don't invent. Brand colors are sacred.

If no brand: derive primary from the aesthetic direction.

| Direction | Primary hint | Avoid |
|---|---|---|
| Brutally minimal | Single saturated accent (emerald, electric blue, hot pink) | Pastels |
| Editorial | Ink black + one prestige color (ink blue, oxblood) | Neons |
| Maximalist | Triadic — 3 saturated hues | Single accent |
| Retro-futuristic | Neon green / cyan / magenta on near-black | Earth tones |
| Luxury | Black + cream + one metal (gold/copper) | Saturated brights |
| Brutalist | None — raw hex codes as decoration | Polished gradients |
| Playful | Primary triad — rounded, saturated | Desaturated grays |

### R10. Gradients are atmospheric, not decorative

Use gradients for atmosphere (hero backgrounds, mesh meshes, card glows) not for button fills. Avoid: 2-stop linear-gradient on a button — looks 2014.

Better: mesh gradients (3+ stops, organic shapes), conic gradients for badges, single-color radial glows for hero atmosphere.

Cite: Adams, *Designer's Dictionary of Color* — gradient as material. Anthropic *frontend-design* — atmospheric backgrounds.

## Pre-ship color checklist

- [ ] Dark or light mode declared explicitly
- [ ] Body text contrast ≥ 4.5:1 against background
- [ ] Large headline contrast ≥ 3:1
- [ ] UI element (border, icon) contrast ≥ 3:1
- [ ] Only ONE primary color used for buttons
- [ ] Accent color used at ≤ 10% of screen area
- [ ] No information encoded in color alone (paired with icon/shape)
- [ ] No pure `#000` or `#FFF`
- [ ] All grays from one temperature family
- [ ] Semantic colors (success/warning/error) not reassigned
- [ ] Deuteranopia simulation passes — no info-loss
- [ ] Brand hex codes copied exactly from the brand profile (if applicable)

## Drill-deeper queries

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book refactoring-ui "color palette saturation"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book interaction-of-color "simultaneous contrast"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book designers-dictionary-of-color "<color name>"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts "WCAG contrast accessibility"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book 100-things "color blindness peripheral"
```
