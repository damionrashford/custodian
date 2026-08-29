# `design.md` — the project-level locked design system

The single source-of-truth file written at a project's root when a design system is **locked** for that project: after a multi-page `studio redesign`, after a `studio study` the user asks to lock, or whenever the user says "lock this system". Every subsequent page build in that project reads this file BEFORE emitting code; where `design.md` and the skill's per-build rule files conflict, **`design.md` wins**.

Referenced by: `verbs/redesign.md` § Multi-page flow · `study.md` § Lock. SKILL.md's pre-flight scan reads it whenever it exists.

## Format

Write `design.md` (or `DESIGN.md` — match the project's existing case convention) with exactly these sections:

````markdown
# Design — <Project name>

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre
<editorial · modern-minimal · atmospheric · playful>

## Macrostructure family
Pick one base macrostructure for marketing pages, one for app pages, one for
content pages (if applicable). Pages within a family share the family's shape;
they vary only in component archetypes.

- Marketing pages: <macrostructure name + the 1–2 archetypes that vary>
- App pages:       <macrostructure name + variation knobs>
- Content pages:   <macrostructure name + variation knobs>

## Theme
- `--color-paper`   oklch(<L> <C> <H>)
- `--color-paper-2` oklch(<L> <C> <H>)
- `--color-ink`     oklch(<L> <C> <H>)
- `--color-ink-2`   oklch(<L> <C> <H>)
- `--color-rule`    oklch(<L> <C> <H>)
- `--color-accent`  oklch(<L> <C> <H>)
- `--color-focus`   oklch(<L> <C> <H>)

## Typography
- Display: <face>, weight <N>, style <normal/italic>
- Body:    <face>, weight <N>
- Mono:    <face>, weight <N>
- Display tracking: <em>
- Type scale anchor: <text-display> = clamp(...)

## Spacing
4-point named scale. The values are in `tokens.css`. Pages must use named
tokens (`var(--space-md)`), never raw values.

## Motion
- Easings: cubic-bezier(<x>, <y>, <z>, <w>) named `--ease-out`, etc.
- Reveal pattern: <fade only / fade + slide / none>
- Reduced-motion fallback: opacity-only, ≤ 150 ms.

## Microinteractions stance
- <silent success / celebratory toasts: never>
- <hover delay 800 ms · focus delay 0 ms>
- <other named choices>

## CTA voice
- Primary CTA: <fill style, shape, copy pattern>
- Secondary CTA: <outline style, shape, copy pattern>

## Per-page allowances
- Marketing pages MAY use enrichment (Tier-A CSS art, Tier-B SVG, etc.).
- App pages MUST NOT use enrichment — function carries the page.
- Content pages: typography only.

## What pages MUST share
- The wordmark / logotype.
- The accent colour and its placement (≤ 5 % per viewport).
- The display + body fonts.
- The CTA voice (button shape, border-radius, padding rhythm).
- Section heading rhythm (numeral + label + display heading pattern — stacked, per gate 66).

## What pages MAY differ on
- Macrostructure within the page-type family (a marketing page can be Marquee
  Hero on one route and Long Document on another — both still use the system's
  type, colour, and CTA voice).
- Hero archetype (within the family's allowance).
- Enrichment — only on marketing pages, only Tier-A or Tier-B.

## Exports

Drop-in formats for re-using this design system in other projects.
See [`export-formats.md`](../rules/export-formats.md) for the canonical mapping.
Emit tokens.css (canonical), plus Tailwind v4 `@theme`, DTCG `tokens.json`, and
shadcn/ui CSS-variable blocks as the project stack requires — all four shapes
are producible from `design/design.json` via `scripts/design/export.ts`.
````

State the picks aloud in plain text BEFORE writing the file, then ask: *"Want me to proceed with this system across every page, or amend any of it first?"* Wait for confirmation.

## After the file is written

1. **Every page build reads `design.md` first.** It overrides catalog rotation, theme picks, and the per-build rule files.
2. **Stamp** every page's CSS with `/* Studio · genre: <genre> · macrostructure: <name> · design-system: design.md · designed-as-app */`. The `designed-as-app` flag tells future Studio runs to read `design.md`, not invent a new system.
3. **One `.studio/log.json` entry** for the multi-page effort, with `"scope": "app"`, instead of one entry per page.
4. **Diversification INVERTS.** Across pages of the same app, consecutive pages MUST share theme, accent, and type pairing; they may differ only on macrostructure within the declared family. The slop-test "differs from previous run" gates (9, 22, 34) are skipped for `designed-as-app` outputs.
5. **Amend, never override.** If a page genuinely needs something `design.md` doesn't allow, amend `design.md` first (add a per-page allowance or `## Variants` section), then build. Pages that silently drift from `design.md` are slop; the audit verb flags drift as `stamp-vs-design.md disagreement`.
