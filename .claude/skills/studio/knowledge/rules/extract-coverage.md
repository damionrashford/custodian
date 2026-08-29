# Extract coverage

Load when: BEFORE running a URL extraction (fast or `--rendered`) to know what each path captures, and to decide whether to recommend `--rendered`.

## What the fast path captures

`extract-url.ts` (default, no `--rendered`):

1. `<meta name="theme-color">` → seed brand color (high weight)
2. All `<link rel="stylesheet" href="...">` (default cap: 5 sheets, 200 KB each; hrefs resolved against the post-redirect URL)
3. All inline `<style>` blocks
4. All `style="..."` attributes (lowest confidence)

Parsed via `css-tree` (community OSS, MIT). AST walks emit:

- **Custom properties** under `:root`, `html`, `body`, `[data-theme]` → highest-confidence color/spacing/typography candidates
- **Color values** in `color`, `background`, `background-color`, `border-color`, `fill`, `stroke` — hex / rgb / hsl / oklch / named all parse; frequency-weighted, k-means clustered in OKLCH, emitted as `oklch(...)` tokens with size-dominant role assignment (bg = dominant cluster, so dark themes survive)
- **Font families** in `font-family:` — classified serif / sans / mono / display via a known-font head table
- **Font sizes** — unique clustered sizes → `text_scale` roles (xs…display)
- **Spacing** in `margin`, `padding`, `gap` — base-unit detection (4 vs 8) + top on-grid steps
- **Border radii** — unique steps → `depth` roles (`radius-sm`…`radius-pill`; 9999px kept categorical)
- **Shadows** in `box-shadow` — top 3 by frequency → `depth` roles (`shadow-sm/md/lg`)
- **Transitions / animations** — durations mapped onto the canonical motion roles (`dur_micro` / `dur_short` / `dur_long`)

## What the fast path CANNOT capture

| Signal | Why source-only fails | Mitigation |
|---|---|---|
| Computed styles after JS hydration | No JS runtime against the page | Use `--rendered` |
| CSS-in-JS resolved values (Emotion, Styled Components) | Class names hashed; no source-to-intent map | Use `--rendered` |
| Theme variants resolved (light vs dark) | Needs runtime media-query + state | Use `--rendered` (resolves both) |
| Critical-path inlined vs deferred CSS | We get both, can't distinguish | Tagged by stylesheet origin |
| Responsive breakpoint-resolved values | Needs viewport simulation | Use `--rendered` (multi-breakpoint pass) |
| Web-font load completion | No FOUT/FOIT visibility | N/A — `font-family` declarations are enough |

## JS-rendered heuristic

`extract-url.ts` flags `coverage_flags.js_rendered: true` AND sets `confidence_global: 0.4` when fewer than 10 color tokens were recovered AND either:
- total CSS bytes are zero while scripts are present (pure-JS shell), or
- `<script>` byte total > 5× total CSS bytes

This pair almost always indicates a site where source-CSS is a shell and the real styling resolves at runtime.

When this flag fires, the agent should:
1. Tell the user: "Source-CSS extraction was thin — likely JS-rendered or CSS-in-JS. For higher fidelity run with `--rendered` after `install-chromium`."
2. STOP. Do not auto-install Chromium. Do not auto-rerun.
3. If the user agrees, run the rendered extraction (see design-store-reference.md § Extract from URL).

## What the rendered path adds

`extract-url.ts --rendered` drives the cdp-headless skill's Chromium singleton (the same browser the visual-iteration loop uses). Captures:

- Fully-resolved computed styles after JS hydration
- CSS-in-JS resolved class values
- Theme variants resolved (page loaded with `prefers-color-scheme: light` THEN `dark`)
- One viewport (1280×800) per color scheme — multi-viewport passes are a possible extension, not current behaviour
- Wait for `document.fonts.ready` before reading
- Critical-path resolution

Cost: ~5–15 s per extraction; reuses the already-running cdp-headless Chromium (no separate install).

## Sticky extraction mode

Every token records `provenance.extraction_mode = "fast" | "rendered"`. Drift-check re-extracts using the same mode as the original — apples-to-apples diff. Mode is read from the first color token in the brand:

```bash
MODE=$(jq -r '.tokens.color[0].provenance.extraction_mode // "fast"' design/design.json)
```

If the user wants to upgrade fast → rendered for an existing brand, they should:
1. Run `extract-url.ts --rendered` against the original URL.
2. Save as a new draft.
3. Run `merge.ts` with both the old store and the new draft. Rendered values outweigh fast (higher per-token confidence). The merged store becomes rendered.

## When to recommend rendered vs fast

| Situation | Recommend |
|---|---|
| Marketing site, docs, blog, static SSR | fast |
| WordPress / Shopify / Squarespace storefronts | fast |
| Modern SPA dashboards (Linear, Vercel, Notion) | rendered |
| Reverse-engineering for design-system seeding | rendered |
| User says "do it quick, partial is fine" | fast (the default) |
| Drift-check against an existing store | match `provenance.extraction_mode` |
