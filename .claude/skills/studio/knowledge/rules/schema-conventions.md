# Schema conventions

Load when: writing to `design/design.json` or any draft under `design/drafts/`; merging drafts; resolving conflicts.

## The shape (schema 0.2.0)

Every design store is a JSON document that validates against `${CLAUDE_SKILL_DIR}/assets/design-system.schema.json`. Top-level shape:

```json
{
  "$schema": "https://github.com/damionrashford/design-system/schema/0.2.0",
  "schema_version": "0.2.0",
  "source_url": "<original URL OR null for moodboard/screenshot/manual>",
  "fetched_at": "<ISO timestamp of first extraction>",
  "updated_at": "<ISO timestamp of most recent merge/edit>",
  "tokens": {
    "color":       [ <Token>, ... ],
    "typography":  [ <Token>, ... ],
    "spacing":     [ <Token>, ... ],
    "text_scale":  [ <Token>, ... ],
    "motion":      [ <Token>, ... ],
    "depth":       [ <Token>, ... ]
  },
  "derived": {
    "states":      { "<role>": { "hover": "...", "active": "...", "disabled": "...", "fg": "..." } },
    "contrast":    [ { "fg": "<role>", "bg": "<role>", "ratio": <number>, "wcag": "AA"|"AAA"|"AA-large"|"fail" } ]
  },
  "coverage_flags": {
    "js_rendered": <bool>,
    "css_in_js_likely": <bool>,
    "theme_variants_found": [ "light", "dark", ... ],
    "responsive_variants_found": [ "375", "768", "1280", "1920" ]
  },
  "confidence_global": <0.0–1.0>,
  "extraction_mode": "fast" | "rendered",
  "history": [
    { "at": "<ISO>", "op": "init|study|design|edit|export|drift|merge|extract", "summary": "..." }
  ]
}
```

Category notes:
- **`depth`** holds radii AND shadows AND z-scale entries; roles are prefixed (`radius-sm`, `radius-pill`, `shadow-md`). Legacy 0.1.0 drafts with separate `radius` / `shadow` categories are folded into `depth` by `merge.ts` automatically.
- **`text_scale`** holds the 7-stop type scale (roles `xs sm md lg xl 2xl display`).
- **`motion`** roles are `ease_out ease_in ease_in_out dur_micro dur_short dur_long` (canon: 120 / 220 / 420 ms — see motion.md).
- **Color values are `oklch(...)` strings. No hex in design.json** (SKILL.md invariant). Extractors normalize any input syntax (hex, rgb, hsl, oklch, named) through `lib/oklch.ts` and emit OKLCH.

## The Token shape (REQUIRED FIELDS)

Every token in `tokens.*` has this shape (`name`, `value`, `category`, `role` are schema-required):

```json
{
  "name": "<kebab-case, unique per category>",
  "value": "<oklch(...) for color · family stack for typography · px/rem for spacing · ms for durations>",
  "category": "color | typography | spacing | text_scale | motion | depth",
  "role": "bg | fg | muted | muted-fg | primary | primary-fg | accent | accent-ink | destructive | border | ring | display | body | mono | xs..display | dur_micro.. | radius-* | shadow-*",
  "provenance": {
    "source_type": "url-fast | url-rendered | screenshot | moodboard | manual | merged | derived",
    "source_url": "<URL or null>",
    "source_selector": "<CSS selector / HTML attribute / image hash>",
    "extraction_mode": "fast | rendered",
    "extracted_at": "<ISO timestamp>",
    "extractor_pass": "<which pass emitted this — e.g. 'css-custom-property' / 'oklch-kmeans' / 'vision-observation' / 'derive-states-coloraide'>"
  },
  "confidence": <0.0–1.0>
}
```

**Provenance is non-negotiable.** Every token records where it came from — that's what makes multi-source merge possible (URL extraction + mood board + manual edit coexist because every token knows its origin).

**Confidence is non-negotiable.** Per-token confidence enables confidence-weighted merging. Defaults by source:
- `url-rendered` with `:root` custom property: 0.95
- `url-rendered` with computed style: 0.85
- `url-fast` with `:root` custom property: 0.90
- `url-fast` with stylesheet value frequency-counted: 0.70
- `screenshot` vision observation: 0.65
- `screenshot` pixel quantization: 0.55
- `moodboard` cluster centroid: 0.50 + (cluster density × 0.40)
- `manual` edit: 1.00

## Merge rules (merge.ts)

For each `(category, role)` slot:

1. **Numeric tokens (spacing, text_scale, radii, durations)**: unit-normalized (rem→px ×16, s→ms ×1000) confidence-weighted average. Mixed units that can't normalize surface as a conflict. `9999px` pill radii are categorical — preserved, never averaged. Confidence becomes `max(...)`.

2. **Color tokens**: weighted centroid in **OKLab space** via `color-math.py` (coloraide) — circular-hue-correct by construction; hues 350° and 10° average to 0°, never 180°. Output stays `oklch(...)`. Confidence becomes `max(...)`.

3. **Categorical tokens (font families, easings, shadow styles)**: NO blend. Higher-confidence draft wins. If all candidates disagree AND every confidence is < 0.8, surface as `conflict` and ask the user.

4. **Conflict surface format** (merge.ts emits to stderr, exit 3):
   ```json
   {
     "conflicts": [
       {
         "category": "typography",
         "role": "display",
         "candidates": [
           { "value": "Fraunces", "confidence": 0.7, "from": "drafts/from-url-...json" },
           { "value": "Newsreader", "confidence": 0.7, "from": "drafts/from-screenshot-...json" }
         ],
         "resolution_required": true,
         "resolution_hint": "Pass --resolve typography.display=\"<value>\" to merge.ts"
       }
     ]
   }
   ```
   Agent parses, asks user, re-runs merge with `--resolve typography.display=Fraunces`.

5. **Provenance trail**: merged tokens keep ALL contributing provenances:
   ```json
   "provenance": {
     "source_type": "merged",
     "sources": [ <provenance-A>, <provenance-B>, ... ],
     "merge_strategy": "confidence-weighted",
     "extracted_at": "<ISO>"
   }
   ```

## Validation rules (validate.ts)

The ajv schema enforces:
- `schema_version` const `"0.2.0"`; `tokens` requires exactly the six categories above (`additionalProperties: false`)
- Token records carry `name`, `value`, `category`, `role`
- `confidence` ∈ [0, 1]
- `history[].op` ∈ the enum above

Runtime conventions the cascade enforces beyond the schema:
- Color values are `oklch(...)` (contrast-check parses them via coloraide; unparseable values are reported as `unparseable`, not silently passed)
- Names unique within their category
- `extraction_mode` ∈ {`fast`, `rendered`}

## Hard rules

- **NEVER write a token without provenance + confidence.**
- **NEVER mutate a token's `provenance` after merge** — extend `provenance.sources` instead.
- **NEVER allow two tokens to share `(category, name)`** — names are unique per category.
- **NEVER auto-resolve a categorical conflict** when all confidences are < 0.8 — surface to user.
- **NEVER lower a confidence on edit** — manual edits set confidence to 1.0 unconditionally.
- **NEVER emit hex into design.json** — OKLCH only.
