# Genre — playful

For the consumer / friendly / onboarding-led page. Soft surfaces, mild colour, motion that responds to hover, friendlier voice. Closer to Notion's marketing or Figma's onboarding than to Stripe's API docs.

## When to pick it

Brief mentions any of: *fun, consumer, casual, family, kids, friendly, approachable, onboarding-heavy, community, social, tactile-but-soft, post-Linear-soft*. Pick playful sparingly — most consumer briefs still belong to editorial (warm-paper, hand-set) unless the user explicitly asks for *softer* and *friendlier*.

## Themes that belong

`Plume` (canonical). The genre is small intentionally — playful is easy to overdo. The loud kinetic themes (Brutal, Riso, Sport) live in editorial but flex playful on consumer-kinetic briefs — see [`themes.md`](../../rules/themes.md). Canonical membership + per-theme tokens: themes.md.

## Voice

- **Display** — Geist Sans 600 with tighter tracking (`-0.025em`), or a bricolage-style display weighted at 700. Friendly, not childish.
- **Body** — Geist Sans 400 in a slightly muted ink (not pure black).
- **Accent** — soft indigo, warm coral, or muted rose at low chroma. Always low — never the saturated consumer-app pop.
- **Layout** — slightly rounded surfaces, soft drop shadows, friendlier card edges (12 px radius is the upper bound).
- **Motion** — responsive on hover (cards lift slightly). One small bounce-free reveal per section. No spring physics on UI state.
- **Copy tone** — warm, direct, specific. Avoid quirk for quirk's sake. *"Made for teams who write together."* over *"For the squad ✨"*.

## What this genre allows

- **Soft drop shadows** on cards (`0 8px 24px -10px <accent at low chroma>`). Restrained.
- **12 px radius** on cards, 8 px on inputs, 999 px on pills.
- **Hover-lift animations** on cards (`translateY(-2px)` + shadow expansion).
- **Mild tinted backgrounds** on alternating sections (paper-2 vs paper, with a tinted band).
- **Soft accent colours** — `oklch(50% 0.13 282)` (indigo) and similar, never above 0.16 chroma.

## What this genre disallows

- **Saturated consumer-app pinks / purples** — colour stays low chroma even if friendly.
- **Emoji-as-decoration** — emoji can appear in copy ("we built X 🌱") but never as visual ornament replacing iconography.
- **Comic Sans, Comic Neue, anything that signals "we're zany"** — playful stays sophisticated.
- **Bouncy / overshoot easings** — gate 13 universal. Even playful uses smooth easings.
- **Glassmorphism** — banned across all genres.
- **Gradient text** — gate 5 universal. Stays banned.

## Voice fixtures

- *"Made for teams who write together."*
- *"Soft, but exact."*
- *"Software can be soft and exact at once. That's the trick."*
- *"For the people who keep things tidy."*
- *"A small tool, gently opinionated."*

## Nav and footer voice

Matches the genre's soft register — this is Plume's chrome, not the loud slab (which belongs to the Brutal/Sport/Riso cluster in editorial):

- **Default nav:** N9 Edge-aligned minimal — wordmark hard-left, single CTA hard-right, breathing room between (Plume's fingerprint in structure.md).
- **Acceptable also:** N5 Floating pill (blur backdrop over a soft tinted hero); N1 Wordmark + 2 links (when destinations are minimal).
- **Default footer:** Ft1 Mast-headed — wordmark + tagline band, warm and quiet.
- **Acceptable also:** Ft5 Statement (a soft closing line); Ft6 Letter close (when the page reads as a note).
- **Banned for playful:** N7 Brutal slab and Ft8 Marquee scroll (loud-poster vocabulary — they fight the soft register; if the brief is genuinely loud-kinetic, the theme belongs to the Brutal/Sport/Riso flex, not to playful).

See [`component-cookbook.md`](../component-cookbook.md) § Navigation and § Footers for the full archetypes + code.

## Stamp signature

```css
/* Studio · genre: playful · macrostructure: <name> · theme: <name> · enrichment: <tier> · nav: <N#> · footer: <Ft#> */
```

## Reference register

The aesthetic to match: soft surfaces, low-chroma colour, friendly-but-restrained type, hover-responsive motion. The post-Linear soft school. Never childish, never quirk-for-quirk.
