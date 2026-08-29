# Research / Empathy Flow

Load when: the user asks "should I…", "what do users want", "is this the right thing to build", "who is this for", OR when SKILL.md STEP 1's JTBD can't be answered in one sentence.

## The discovery sequence

### Step 1 — Re-frame from feature to outcome

User-stated request is almost always at the feature layer. Push down to the outcome layer.

| User says | Outcome layer | Re-frame question |
|---|---|---|
| "Add a settings page" | Avoiding regret / staying in control | What setting are they actually trying to find? |
| "Make a dashboard" | Confidence about state | What number do they check first thing Monday? |
| "Build a checkout" | Trust + speed | What anxiety are they fighting at the form? |
| "Onboarding flow" | First-time success | What single action means they "got it"? |

Cite: Cooper et al., *About Face* — goals vs. tasks. Norman, *Design of Everyday Things* — gulf of execution.

### Step 2 — Map the user (the 5-line persona)

Skip the photo. Write 5 lines:

```
Role           — what they do all day
Frequency      — how often they hit this
Sophistication — beginner / power user / expert
Context        — desk / phone / kiosk / kitchen / car
Anti-goal      — what they fear or want to avoid
```

Cite: Cooper et al., *About Face* — primary persona doctrine. Eyal, *Hooked* — internal trigger = pain to relieve.

### Step 3 — Mental model check

Run a search for the named law that governs this user's expectation:

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book laws-of-ux --limit 3 "<topic>"
```

The two laws to check by default:
- **Jakob's Law** — users spend most time on other sites. Your design lives in the shadow of those defaults. Yablonski, *Laws of UX*, ch. on Jakob's Law.
- **Mental model** — what the user expects vs what the system does. Norman, *Design of Everyday Things*, on conceptual models.

Output: name one site/app whose pattern the user already knows. You inherit that pattern's affordances OR you must teach the new one explicitly.

### Step 4 — Identify the friction surface

Three places friction lives:

1. **Cognitive** — the user has to think (Krug, *Don't Make Me Think* — "if it makes me think, redesign it").
2. **Motoric** — the user has to move (Fitts's Law — distance + target size).
3. **Emotional** — the user has to feel something difficult (forms about money, identity, loss).

Pick the dominant friction. The design's job is to absorb that friction.

Cite: Krug, *Don't Make Me Think*; Yablonski, *Laws of UX* (Fitts); Weinschenk, *100 Things* — emotional design.

### Step 5 — Define success in one observable event

Not "increase engagement". Not "feels good". One observable.

| Bad | Good |
|---|---|
| Users like it | User completes the action in ≤ 30s without scrolling |
| Higher conversion | Primary CTA click rate hits 12% |
| Cleaner UI | Empty state never appears for an authenticated user |
| More intuitive | New user finds the API key within 2 clicks of first login |

Cite: Lidwell et al., *Universal Principles of Design* — performance load.

### Step 6 — Risk catalog

Before designing, name what could go wrong. Pick the top 3 from this list:

- **Accessibility** — keyboard-only user can't reach primary action
- **Performance perception** — Doherty Threshold (>400ms feels broken; Yablonski, *Laws of UX*)
- **Choice overload** — Hick's Law (more options = slower decision)
- **Trust erosion** — destructive action without confirmation, hidden cost, surprise
- **Recall failure** — Miller's Law (working memory ≤ 7±2 items)
- **Selective attention miss** — change blindness; user won't see the banner (Weinschenk, *100 Things*)
- **Peak-End violation** — last moment of the flow is the one remembered (Yablonski, *Laws of UX*)
- **Aesthetic-usability mismatch** — pretty but unusable scores well in surveys, badly in retention

Each risk becomes a STEP 8 critique check.

## Exit

Hand back to SKILL.md DESIGN STEP 1 with:
- JTBD sentence (no UI nouns)
- 5-line persona
- 1-2 named laws governing expectation
- Dominant friction surface
- One observable success criterion
- Top-3 risk list

If the user resists answering any of these, ask once. If they say "just build it" — note the gap in Open Decisions at the end, proceed with default assumptions, and flag the bet.

## Brand-named seeding

If the user named a real brand ("make it feel like Stripe", "$brand = linear") and that brand's design system is worth studying rather than imitating from memory:

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/fetch-design-system.ts --slug <brand>
bun ${CLAUDE_SKILL_DIR}/scripts/library/embed.ts --book <brand>
bun ${CLAUDE_SKILL_DIR}/scripts/library/page.ts --book <brand> --page 1
```

The fetched `## Overview`, `## Colors`, `## Typography` pages seed STEP 2/3/4 picks the way a `studio study` diagnosis would — as grounding, never as tokens to copy verbatim (the build still passes every gate, including gate 69's studied-DNA discipline).
