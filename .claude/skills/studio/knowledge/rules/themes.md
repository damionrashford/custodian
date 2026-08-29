# Themes — the 22-theme catalog, defined

Single source of truth for every named Studio theme. Picked at STEP 2; tokens are **seeded from here, never improvised** (slop gate 58). Genre membership here is canonical and supersedes any lists in genre files or component-cookbook routing tables. Nav/footer defaults mirror `structure.md` § Theme-suggested fingerprints; the cookbook's routing tables list acceptable alternates.

Every palette below was machine-verified (coloraide/WCAG 2.1): ink-on-paper ≥ 7:1, muted-on-paper ≥ 4.5:1, accent-ink-on-accent ≥ 4.5:1, focus-on-paper ≥ 3:1. The cascade (`derive-states.ts` → `contrast-check.ts`) still runs on every build and remains authoritative — these are seeds, not exemptions.

## Genre membership (canonical)

| Genre | Themes | Temperament |
|---|---|---|
| **editorial** (default) | Editorial · Salon · Newsprint · Almanac · Atelier · Garden · Linen · Specimen · Studio · Riso · Sport · Brutal · Manifesto | print-rooted; spans quiet (Salon, Linen) to loud poster (Brutal, Sport, Manifesto) |
| **modern-minimal** | Quiet · Coral · Violet | restrained product surfaces |
| **atmospheric** | Bloom · Midnight · Terminal · Aurora · Halo | dark canvas, mood-first |
| **playful** | Plume | soft consumer; deliberately small |

Secondary-genre flex (real, not theoretical): Specimen + Studio flex modern-minimal on product briefs; Riso / Sport / Brutal flex playful-loud when the brief is consumer-kinetic; Coral flexes playful. Note the flex in the stamp when used.

---

## Editorial — classic magazine: black-on-white, serif displays, one link-red

```css
--color-paper:      oklch(97.5% 0.003 90);
--color-paper-2:    oklch(94.5% 0.004 90);
--color-ink:        oklch(18% 0.005 90);
--color-muted:      oklch(45% 0.008 90);
--color-accent:     oklch(48% 0.17 25);
--color-accent-ink: oklch(97.5% 0.003 90);
--color-focus:      oklch(48% 0.17 25);
```
display: Newsreader (italic available) · body: IBM Plex Sans · outlier: JetBrains Mono
depth: flat · radius: sharp · motion: quiet fade-up, one entrance
band: light · accent: warm
nav: N6 Masthead · footer: Ft1 Mast-headed

## Salon — literary parlor: warm cream, high-contrast serif, oxblood

```css
--color-paper:      oklch(95.5% 0.015 85);
--color-paper-2:    oklch(92.5% 0.018 85);
--color-ink:        oklch(26% 0.03 50);
--color-muted:      oklch(47% 0.03 50);
--color-accent:     oklch(42% 0.14 25);
--color-accent-ink: oklch(96% 0.01 85);
--color-focus:      oklch(42% 0.14 25);
```
display: Fraunces (deep italic) · body: Newsreader · outlier: —
depth: flat + fleuron ornament · radius: soft · motion: none — the page is set, not staged
band: light · accent: warm
nav: N6 Masthead · footer: Ft1 Mast-headed

## Newsprint — warm gray broadsheet, red second ink

```css
--color-paper:      oklch(93% 0.006 90);
--color-paper-2:    oklch(90% 0.007 90);
--color-ink:        oklch(20% 0.005 90);
--color-muted:      oklch(44% 0.008 90);
--color-accent:     oklch(50% 0.19 28);
--color-accent-ink: oklch(97% 0.004 90);
--color-focus:      oklch(50% 0.19 28);
```
display: Newsreader 700 · body: Source Serif 4 · outlier: IBM Plex Mono
depth: flat, double rules · radius: sharp · motion: none
band: light · accent: warm
nav: N6 Masthead · footer: Ft4 Dense colophon

## Almanac — amber reference-book: sepia ink, tabular everything

```css
--color-paper:      oklch(94% 0.02 85);
--color-paper-2:    oklch(91% 0.022 85);
--color-ink:        oklch(25% 0.04 60);
--color-muted:      oklch(46% 0.04 60);
--color-accent:     oklch(48% 0.11 75);
--color-accent-ink: oklch(96% 0.012 85);
--color-focus:      oklch(48% 0.11 75);
```
display: Cardo · body: IBM Plex Sans · outlier: IBM Plex Mono (tabular numerals everywhere)
depth: flat, hairlines · radius: sharp · motion: number-tick reveal only
band: light · accent: warm
nav: N3 Side-rail · footer: Ft3 Index columns

## Atelier — warm gallery white, charcoal, one ochre pigment

```css
--color-paper:      oklch(96.5% 0.008 85);
--color-paper-2:    oklch(93.5% 0.01 85);
--color-ink:        oklch(24% 0.015 60);
--color-muted:      oklch(46% 0.018 60);
--color-accent:     oklch(62% 0.13 70);
--color-accent-ink: oklch(20% 0.015 60);
--color-focus:      oklch(50% 0.13 70);
```
display: Instrument Serif · body: Crimson Pro · outlier: —
depth: flat, negative space only · radius: sharp · motion: type-unmask on the display line
band: light · accent: warm
nav: N9 Edge-aligned minimal · footer: Ft6 Letter close

## Garden — botanical: leaf-green ink on cream

```css
--color-paper:      oklch(96% 0.012 110);
--color-paper-2:    oklch(93% 0.014 110);
--color-ink:        oklch(24% 0.04 140);
--color-muted:      oklch(45% 0.04 140);
--color-accent:     oklch(45% 0.12 145);
--color-accent-ink: oklch(97% 0.008 110);
--color-focus:      oklch(45% 0.12 145);
```
display: Cormorant Garamond · body: Crimson Pro · outlier: —
depth: flat, marginalia · radius: soft · motion: none
band: light · accent: cool
nav: N9 Edge-aligned minimal · footer: Ft6 Letter close

## Linen — warm textile off-white, flax-indigo accent

```css
--color-paper:      oklch(95.5% 0.012 80);
--color-paper-2:    oklch(92.5% 0.014 80);
--color-ink:        oklch(28% 0.02 60);
--color-muted:      oklch(47% 0.022 60);
--color-accent:     oklch(45% 0.09 270);
--color-accent-ink: oklch(96.5% 0.008 80);
--color-focus:      oklch(45% 0.09 270);
```
display: Sentient · body: Switzer · outlier: —
depth: flat · radius: default · motion: fade-up, gentle
band: light · accent: cool
nav: N6 Masthead · footer: Ft1 Mast-headed

## Specimen — type-foundry neutral + specimen red

```css
--color-paper:      oklch(97.5% 0.004 80);
--color-paper-2:    oklch(94.5% 0.005 80);
--color-ink:        oklch(22% 0.01 80);
--color-muted:      oklch(45% 0.012 80);
--color-accent:     oklch(52% 0.19 27);
--color-accent-ink: oklch(97.5% 0.004 80);
--color-focus:      oklch(52% 0.19 27);
```
display: Fraunces · body: Switzer · outlier: Geist Mono (specimen labels)
depth: flat, hairlines · radius: sharp · motion: fade-up staggered
band: light · accent: warm
nav: N5 Floating pill · footer: Ft2 Inline single line

## Studio — the house workshop theme: warm neutral, small green accent

```css
--color-paper:      oklch(96.5% 0.005 90);
--color-paper-2:    oklch(93.5% 0.006 90);
--color-ink:        oklch(21% 0.01 90);
--color-muted:      oklch(45% 0.012 90);
--color-accent:     oklch(52% 0.13 150);
--color-accent-ink: oklch(97.5% 0.004 90);
--color-focus:      oklch(52% 0.13 150);
```
display: Instrument Serif · body: Geist · outlier: Geist Mono
depth: flat · radius: default · motion: fade-up, restrained
band: light · accent: cool
nav: N7 Brutal slab · footer: Ft3 Index columns

## Riso — risograph two-ink: punchy pink on warm off-white

```css
--color-paper:      oklch(95% 0.01 90);
--color-paper-2:    oklch(92% 0.012 90);
--color-ink:        oklch(20% 0.01 90);
--color-muted:      oklch(44% 0.012 90);
--color-accent:     oklch(62% 0.21 0);
--color-accent-ink: oklch(18% 0.02 0);
--color-focus:      oklch(50% 0.19 0);
```
display: Bricolage Grotesque 700 · body: Switzer · outlier: Space Mono
depth: flat, grain texture allowed · radius: sharp · motion: none — print doesn't animate
band: light · accent: chromatic-other
nav: N7 Brutal slab · footer: Ft8 Marquee scroll

## Sport — loud condensed: track red, italic display

```css
--color-paper:      oklch(96% 0.004 250);
--color-paper-2:    oklch(92.5% 0.005 250);
--color-ink:        oklch(15% 0.01 250);
--color-muted:      oklch(43% 0.012 250);
--color-accent:     oklch(52% 0.2 27);
--color-accent-ink: oklch(98% 0.003 250);
--color-focus:      oklch(52% 0.2 27);
```
display: Big Shoulders Display (italic moments) · body: Geist · outlier: Space Grotesk (numerals)
depth: flat, bleed-colour dividers · radius: sharp · motion: horizontal sweep
band: light · accent: warm
nav: N7 Brutal slab · footer: Ft8 Marquee scroll

## Brutal — raw concrete + one shock accent

```css
--color-paper:      oklch(92% 0.005 260);
--color-paper-2:    oklch(88% 0.006 260);
--color-ink:        oklch(15% 0.02 260);
--color-muted:      oklch(41% 0.02 260);
--color-accent:     oklch(50% 0.21 29);
--color-accent-ink: oklch(97% 0.004 260);
--color-focus:      oklch(50% 0.21 29);
```
display: Bricolage Grotesque 800 · body: Geist · outlier: Space Grotesk
depth: flat, 2px borders · radius: 0 everywhere · motion: horizontal sweep only
band: light · accent: warm
nav: N7 Brutal slab · footer: Ft8 Marquee scroll

## Manifesto — stark declarative dark: poster energy

```css
--color-paper:      oklch(18% 0.01 260);
--color-paper-2:    oklch(23% 0.012 260);
--color-ink:        oklch(95% 0.005 260);
--color-muted:      oklch(72% 0.008 260);
--color-accent:     oklch(52% 0.21 27);
--color-accent-ink: oklch(97% 0.003 260);
--color-focus:      oklch(75% 0.13 27);
```
display: Anton · body: Geist · outlier: —
depth: flat, bleed-colour blocks · radius: 0 · motion: horizontal sweep
band: dark · accent: warm
nav: N7 Brutal slab · footer: Ft5 Statement

## Quiet — barely-there monochrome (gate-8 / gate-24 modern-minimal exceptions apply)

```css
--color-paper:      oklch(100% 0 0);
--color-paper-2:    oklch(97% 0 0);
--color-ink:        oklch(25% 0 0);
--color-muted:      oklch(48% 0 0);
--color-accent:     oklch(25% 0 0);       /* accent IS ink — monochrome discipline */
--color-accent-ink: oklch(100% 0 0);
--color-focus:      oklch(55% 0.18 260);  /* the one chromatic note: focus only */
```
display: Geist 600 · body: Geist 400 · outlier: Geist Mono (single-family discipline)
depth: flat, subtle borders · radius: default, pill CTAs · motion: none — the page is composed
band: light · accent: neutral
nav: N9 Edge-aligned minimal · footer: Ft2 Inline single line

## Coral — warm light minimal, coral accent

```css
--color-paper:      oklch(97% 0.006 40);
--color-paper-2:    oklch(94% 0.008 40);
--color-ink:        oklch(24% 0.015 40);
--color-muted:      oklch(46% 0.018 40);
--color-accent:     oklch(66% 0.17 30);
--color-accent-ink: oklch(18% 0.02 30);
--color-focus:      oklch(55% 0.16 30);
```
display: General Sans · body: Switzer · outlier: —
depth: elevated (soft 2-layer shadows) · radius: soft · motion: hover-lift only
band: light · accent: warm
nav: N5 Floating pill · footer: Ft1 Mast-headed

## Violet — cool light minimal, violet accent

```css
--color-paper:      oklch(97.5% 0.005 300);
--color-paper-2:    oklch(94.5% 0.007 300);
--color-ink:        oklch(24% 0.02 300);
--color-muted:      oklch(46% 0.022 300);
--color-accent:     oklch(48% 0.19 300);
--color-accent-ink: oklch(97.5% 0.005 300);
--color-focus:      oklch(48% 0.19 300);
```
display: Switzer 600 · body: Geist · outlier: Geist Mono
depth: flat · radius: default, pill CTAs · motion: fade-up, minimal
band: light · accent: cool
nav: N5 Floating pill · footer: Ft2 Inline single line

## Bloom — atmospheric canonical: dark plum canvas, warm coral bloom

```css
--color-paper:      oklch(15% 0.02 320);
--color-paper-2:    oklch(20% 0.024 320);
--color-ink:        oklch(92% 0.01 320);
--color-muted:      oklch(70% 0.015 320);
--color-accent:     oklch(70% 0.16 25);
--color-accent-ink: oklch(18% 0.03 25);
--color-focus:      oklch(70% 0.16 25);
```
display: Geist 600 · body: Geist · outlier: Geist Mono
depth: glass (one blur layer over blooms) · radius: default, pill CTAs · motion: fade-in only; blooms static (≤2, 20–30 %, background-only)
band: dark · accent: warm
nav: N5 Floating pill · footer: Ft5 Statement

## Midnight — deep blue-black, electric indigo

```css
--color-paper:      oklch(17% 0.03 265);
--color-paper-2:    oklch(22% 0.035 265);
--color-ink:        oklch(93% 0.01 265);
--color-muted:      oklch(70% 0.02 265);
--color-accent:     oklch(62% 0.17 275);
--color-accent-ink: oklch(14% 0.03 275);
--color-focus:      oklch(62% 0.17 275);
```
display: Geist 600 · body: Geist · outlier: Geist Mono (numbered display labels)
depth: flat, hairlines · radius: default · motion: typewriter reveal on display labels
band: dark · accent: cool
nav: N5 Floating pill · footer: Ft2 Inline single line

## Terminal — phosphor on near-black; mono-everywhere IS the design

```css
--color-paper:      oklch(16% 0.015 150);
--color-paper-2:    oklch(21% 0.018 150);
--color-ink:        oklch(82% 0.17 150);
--color-muted:      oklch(60% 0.06 150);
--color-accent:     oklch(80% 0.14 80);
--color-accent-ink: oklch(16% 0.015 80);
--color-focus:      oklch(80% 0.14 80);
```
display: JetBrains Mono 700 · body: JetBrains Mono 400 · outlier: — (single-font-as-design, per typography.md)
depth: flat · radius: 0 · motion: typewriter + block cursor (nav only, per N8)
band: dark · accent: warm
nav: N8 Terminal command · footer: Ft4 Dense colophon

## Aurora — dark canvas, green-teal aurora accent

```css
--color-paper:      oklch(16% 0.025 250);
--color-paper-2:    oklch(21% 0.028 250);
--color-ink:        oklch(93% 0.008 200);
--color-muted:      oklch(70% 0.012 200);
--color-accent:     oklch(75% 0.14 175);
--color-accent-ink: oklch(15% 0.03 175);
--color-focus:      oklch(75% 0.14 175);
```
display: Tomorrow · body: Geist · outlier: JetBrains Mono
depth: glass over aurora gradient (background-only, static) · radius: default · motion: fade-up, slow (atmospheric 1500ms+ allowed on background)
band: dark · accent: cool
nav: N5 Floating pill · footer: Ft5 Statement

## Halo — dark with a pale ring-glow accent

```css
--color-paper:      oklch(14% 0.01 270);
--color-paper-2:    oklch(19% 0.012 270);
--color-ink:        oklch(94% 0.005 270);
--color-muted:      oklch(71% 0.008 270);
--color-accent:     oklch(85% 0.08 90);
--color-accent-ink: oklch(15% 0.015 90);
--color-focus:      oklch(85% 0.08 90);
```
display: Sentient · body: Geist · outlier: Geist Mono
depth: flat with one halo ring (CSS radial, background-only) · radius: soft · motion: fade-in only
band: dark · accent: warm
nav: N5 Floating pill · footer: Ft5 Statement

## Plume — playful canonical: blush-white, soft indigo

```css
--color-paper:      oklch(97.5% 0.008 320);
--color-paper-2:    oklch(94.5% 0.01 320);
--color-ink:        oklch(26% 0.02 300);
--color-muted:      oklch(47% 0.022 300);
--color-accent:     oklch(50% 0.13 282);
--color-accent-ink: oklch(97.5% 0.006 320);
--color-focus:      oklch(50% 0.13 282);
```
display: Satoshi 700 · body: Geist · outlier: —
depth: elevated-soft (`0 8px 24px -10px` accent-tinted) · radius: soft (12px cards / 8px inputs / pill CTAs) · motion: hover-lift, one bounce-free reveal per section
band: light · accent: cool
nav: N9 Edge-aligned minimal · footer: Ft1 Mast-headed
