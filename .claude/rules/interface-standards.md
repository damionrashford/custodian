---
paths:
  - "src/surfaces/**/*.ts"
  - "src/**/interface/**/*.{ts,tsx}"
  - "**/*.{tsx,css,html}"
---

# Interface Standards

The interface is the accountability layer between user intent and autonomous action, not a presentation surface applied after the model works. Full detail: `.research/Design_Interface_Standards.txt`.

## Hard constraint: Article 50 disclosure (already in force, not craft judgement)

AI involvement must be disclosed **in the interaction surface itself**, at first contact, in the same visual weight as other primary text — not a tooltip, footer, or settings page. A vague "assistant" reference or terms-and-conditions mention does not satisfy this. Agent-generated content carries a persistent visible marker surviving scroll/collapse/copy. Disclosure copy is a design-reviewed artefact, jointly owned by Design and Legal, versioned in the prompt/config registry. Fines up to €15M / 3% of global turnover for non-compliance.

## Design principles

1. **Legibility** — the agent's plan, current step, and tool use are visible without asking.
2. **Calibrated trust** — confidence surfaced selectively (low confidence or high stakes only); universal display trains users to ignore it.
3. **Control plane** — autonomy is a spectrum (suggest / act-with-approval / act-and-notify / act-silently-within-limits) per action class and tenant, not a binary switch.
4. **Recoverability** — every agent output carries a visible edit/reject/flag affordance; a rejection is the highest-quality eval signal available and must flow to the golden dataset.

## Token architecture (two layers, always)

Primitives hold raw values, never referenced by components directly. Semantic tokens express intent and are the only thing components reference. A hard-coded hex/pixel value in a component is a defect. Agent-state gets first-class semantic tokens (`--agent-thinking`, `--agent-acting`, `--agent-awaiting-approval`, `--agent-confidence-low`, `--agent-error`, `--agent-disclosure`) — status is the primary information channel in this product, not a decorative concern.

## Spacing

4px base unit, 8px rhythm. **Internal ≤ external**: space around a group must equal or exceed space within it, or the grouping reads backwards. Whitespace is proportional (section break > paragraph break > line break), not uniform. Density is contextual — an operator console is dense/information-first, an approval dialog is not; don't apply one density to both. Body copy: 60–75 characters per line.

## Typography

Fluid via `clamp()`, bounds in `rem`, scaling term in `vw` — never `vw`-only (defeats browser zoom/assistive tech). Two families + one mono (tokens, IDs, code, cost figures — anything copy-pasted or character-compared). Line height 1.5 body / 1.2–1.3 headings / 1.4 dense tabular. Three weights max. Tabular figures for all metrics/costs/latency so columns align. Sentence case throughout, no all-caps except small utility labels.

## Accessibility baseline

WCAG 2.2 AA is the floor (2.2 is a superset of 2.1 — building to 2.1 today is not cheaper). Watch specifically for: **Target Size** (≥24×24px — dense table row actions fail this first), **Focus Not Obscured** (sticky headers/status bars covering focused rows), **Focus Appearance** (≥2px perimeter, ≥3:1 contrast on custom controls), **Dragging Movements** (non-drag alternative required), **Accessible Auth** (no cognitive-function test, no blocked password paste). Automated tooling catches ~30–40% of issues — budget the manual keyboard/screen-reader pass; a green Lighthouse score is a starting point, not conformance.

## Agent interaction — 7 states, all must be designed including failure/recovery

| State | What the user must see |
|---|---|
| Queued | Position or expected start — never a bare indeterminate spinner |
| Thinking | Reasoning underway, current objective in plain language |
| Acting | Which tool, on what, with what scope |
| Awaiting approval | What happens on approval vs. rejection, and any deadline |
| Streaming | Partial output rendered progressively |
| Recovering | Retry in progress, which attempt, whether cost is being re-incurred |
| Failed | What failed, at which step, **what was already committed**, single next action |

The "already committed" detail matters most — because the platform performs real side effects (webhooks, billing, writes), a failure message that omits what already happened forces the user to go check elsewhere, and that's the moment trust breaks, not the failure itself.

Sub-agent handoffs must be visible when work transfers between agents — an invisible handoff reads as the system stalling.

## Interface vocabulary

Two registers banned from user-facing copy: **implementation language** (describes the system to itself — asks the user to understand the architecture) and **marketing language** (describes the system to a buyer — asks the user to be impressed). Vocabulary is scoped by surface: operator console permits domain terms (that audience's real working vocabulary); tenant admin, approval/intervention, and end-user surfaces are plain-language only.

Never surface: stack traces, exception class names, internal service names, database column names, model identifiers (on end-user surfaces), raw provider errors. These are simultaneously a usability failure and an information-disclosure risk.

Test for reviewers: read the string aloud to someone outside the product — if they ask a clarifying question about the system rather than their own task, the copy failed regardless of accuracy.

Enforcement: all user-facing strings live in a localisation catalogue (never inline), a banned-lexicon CI check runs against it per surface, error strings are reviewed as a set (cause + cost implication + next action required per entry).

## Design review gates (all blocking except manual a11y + restraint, which are reviewer judgement)

Tokens only (no hard-coded values) · 4px grid + internal≤external · `clamp()` in rem · AA contrast · targets ≥24×24 · full keyboard operation · `prefers-reduced-motion` respected · Article 50 disclosure perceivable (Legal) · all 7 agent states designed · strings externalised · vocabulary check passes · every error has cause/cost/next-action.
