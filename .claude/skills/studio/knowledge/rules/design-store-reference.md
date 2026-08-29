# Design store reference — token persistence & extraction

Load when: the user asks to extract tokens from a URL / screenshot / mood board, seed a design from an existing `design.json`, merge drafts, edit a token, export, or run a drift check. This is the full procedure; SKILL.md keeps only a pointer.

All paths assume `${CLAUDE_SKILL_DIR}` is the studio skill root. The **cascade** (derive-states → contrast-check → validate) is MANDATORY after every merge or edit — see bottom.

## Init

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/init.ts --dir design
```
Creates `design/design.json`, `design/DESIGN.md`, `design/drafts/`, `design/reports/`. Write `state.design_dir`.

## Extract from URL

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/extract-url.ts <URL> \
  --output design/drafts/from-url-<host>-<ISO>.json \
  --max-stylesheets 5 --max-stylesheet-bytes 204800
```
If `coverage_flags.js_rendered: true` OR `confidence_global < 0.5`: tell the user "CSS extraction was thin. Want me to re-run with `--rendered`?" Stop. Never auto-install Chromium.

Rendered (opt-in only — drives the cdp-headless skill's Chromium singleton; no separate install):
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/extract-url.ts <URL> --rendered \
  --output design/drafts/from-url-rendered-<host>-<ISO>.json
```

## Extract from screenshot

Vision pass first: top 6 hex, accent, bg/fg, type categories (serif/sans/display/mono) + weight range, spacing, radius, shadow, mood (3-5 words).
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/extract-image.ts <image> \
  --output design/drafts/from-screenshot-<ISO>.json \
  --vision-json <(echo '<vision JSON>')
```

## Extract from mood board

```bash
echo '<aggregated hex array>' | bun ${CLAUDE_SKILL_DIR}/lib/oklch.ts cluster \
  --k auto --output design/drafts/from-moodboard-<ISO>.json --provenance "moodboard:$folder"
```

## Merge

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/merge.ts \
  --drafts <a>.json,<b>.json --output design/design.json \
  --strategy confidence-weighted --lockfile design/.merge.lock
```
Pill radius (`9999px`) preserved categorically — never averaged. Categorical conflicts surface on stderr → present to user, re-run with `--resolve key=value`.

## Cascade (MANDATORY after every merge or edit)

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/derive-states.ts --brand design/design.json --in-place
bun ${CLAUDE_SKILL_DIR}/scripts/design/contrast-check.ts --brand design/design.json --level AA
bun ${CLAUDE_SKILL_DIR}/scripts/design/validate.ts --brand design/design.json
```

## Edit token

Edit `design/design.json` via the Edit tool. Stamp `provenance.source_type="manual"`, `confidence=1.0`, `edited_at=<ISO>`. Run cascade. If contrast fails: stop, report pair + ratio + minimum. Never auto-correct.

## Export

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/design/export.ts \
  --brand design/design.json \
  --format <css-vars|scss|w3c|json|tailwind-v4> \
  --output <path outside design dir>
```

## Drift check

```bash
MODE=$(jq -r '.tokens.color[0].provenance.extraction_mode // "fast"' design/design.json)
RENDERED=""; [ "$MODE" = "rendered" ] && RENDERED="--rendered"
bun ${CLAUDE_SKILL_DIR}/scripts/design/extract-url.ts <url> $RENDERED \
  --output design/drafts/drift-<ISO>.json
bun ${CLAUDE_SKILL_DIR}/scripts/design/drift-diff.ts \
  --baseline design/design.json --current design/drafts/drift-<ISO>.json \
  --output design/reports/drift-<ISO>.md
```
