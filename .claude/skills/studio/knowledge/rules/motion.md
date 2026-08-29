# Motion & interaction — states, transitions, micro-interactions

Load when: designing any interactive element (button, link, input, card, tab, modal, drawer), defining hover/focus/active behavior, or animating between states. STEP 6 in SKILL.md.

## Decision tree

1. **Enumerate every state** of every interactive element. Don't ship a button without all states defined.
2. **Pick a motion language** — none / whisper / choreographed / spring. Stay consistent.
3. **Choose easing curves**, not durations alone. Durations follow easing.
4. **Reserve motion for meaning.** Decorative animation is noise.

## The required states

For every interactive element, you must define:

| State | Trigger | Visual change |
|---|---|---|
| rest | default | base styling |
| hover | mouse over (desktop only) | subtle elevation, bg shift, or border accent |
| focus-visible | keyboard tab | high-contrast ring (3:1 against bg) |
| active / pressed | mousedown / touchdown | inset shadow, slight scale (0.97–0.99) |
| disabled | aria-disabled | reduced opacity (0.5–0.6) + cursor not-allowed + NO hover |
| loading | async in flight | spinner replacing label or skeleton replacing content |
| selected | aria-selected (tabs, list items) | distinct surface + accent border |
| empty | no data | illustration + call-to-action |
| error | validation failed | red border + label + helper text |

If you skip a state, the user falls off a cliff. Cite: Cooper et al., *About Face* — state design.

## Rules

### R1. The focus ring is a primary feature, not an afterthought

Keyboard users — including 100% of screen-reader users — depend on `:focus-visible`. Make the ring:
- 2–3px solid (or `outline-offset: 2px` for breathing room)
- High contrast (3:1 minimum against the element AND the background)
- Same shape as the element (rounded for rounded buttons)

Anti-pattern: `outline: none` without replacement. That's an accessibility failure.

Cite: Pickering, *Inclusive Components* — keyboard focus. Yablonski, *Laws of UX* — accessibility.

### R2. Hit targets ≥ 44×44px (Fitts's Law)

Mobile touch targets: 44×44 minimum (Apple HIG / WCAG). Desktop clickable: 32×32 minimum.

The hit area can be larger than the visual via padding or pseudo-element extending the click region.

Cite: Yablonski, *Laws of UX* — Fitts's Law (touch targets). Pickering, *Inclusive Components* — target size.

### R3. Doherty Threshold — feedback within 400ms

User actions need feedback ≤ 400ms or the system feels broken. If you can't complete the work in 400ms:

- < 100ms: no feedback needed
- 100–400ms: subtle pending state (button label color shift)
- 400ms – 1s: spinner inside the button replacing label
- 1s – 5s: skeleton UI for the section being loaded
- > 5s: progress bar with stage labels, dismissible

Cite: Yablonski, *Laws of UX* — Doherty Threshold; Weinschenk, *100 Things* — response time.

### R4. Easing curves carry meaning

| Curve | CSS | Use |
|---|---|---|
| `linear` | `linear` | Loading bars, ticks — never UI motion |
| Standard ease-out | `cubic-bezier(0, 0, 0.2, 1)` | Element entering — fast start, soft land |
| Standard ease-in | `cubic-bezier(0.4, 0, 1, 1)` | Element leaving |
| Standard ease-in-out | `cubic-bezier(0.4, 0, 0.2, 1)` | Element moving between two positions |
| Spring (anticipatory) | use Framer Motion / Motion / RN spring | Toggles, drawers — feels alive |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot/back | Playful confirms, badges |

Defaults: enter with ease-out (200–250ms), exit with ease-in (150–200ms). Always faster on exit than entry.

Cite: Cooper et al., *About Face* — interaction tempo.

### R5. Duration scale

| Motion | Duration |
|---|---|
| Hover color shift | 150ms |
| Button press scale | 100ms |
| Tooltip appear | 200ms |
| Dropdown / popover | 200–250ms |
| Modal / drawer | 250–350ms |
| Page transition | 300–500ms |
| Atmospheric (hero, background) | 1500ms+ |

If two animations overlap, the bigger one is slower. Cite: Weinschenk, *100 Things* — perception of speed.

### R6. Hover states don't exist on touch

Don't put critical information in hover-only reveals. Tooltips that explain icons must be tappable on touch (long-press or tap-to-reveal). Cards that gain detail on hover need a tap-equivalent.

Cite: Pickering, *Inclusive Components* — tooltip patterns.

### R7. Reduce-motion respect

`@media (prefers-reduced-motion: reduce)`: replace all transforms/translates with opacity-only fades or zero motion. Many users have vestibular disorders.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Cite: Pickering, *Inclusive Components* — reduced motion; Yablonski, *Laws of UX* — accessibility.

### R8. Choreography over decoration

A page load with five elements: don't fade them all simultaneously. Stagger with 40–80ms `animation-delay`. The eye lands on the lead, then follows.

Anti-pattern: every element animates on scroll. The user can't read past the noise.

Cite: Anthropic *frontend-design* — one well-orchestrated reveal beats scattered micro-interactions.

### R9. Confirmation, not interruption

For destructive actions: use a confirmation dialog (modal) — not just a tooltip. For undoable actions: skip the modal, show a toast with "Undo" for 5–10s. Cite: Cooper et al., *About Face* — interaction patterns.

### R10. Loading patterns

| Strategy | When |
|---|---|
| Skeleton UI (gray boxes mimicking final layout) | Initial page load, list fetch |
| Spinner inside button | Form submit |
| Optimistic update (show result before confirm) | Likes, toggles, add-to-cart |
| Streaming (progressive content) | Long generation, chat |
| Empty state with CTA | First-time, no data yet |

Anti-pattern: full-page spinner. Blanks the user out and feels slow.

Cite: Yablonski, *Laws of UX* — Doherty Threshold; *100 Things* — perception of waiting.

## Pre-ship motion checklist

- [ ] Every interactive element has all 9 states defined
- [ ] `:focus-visible` ring is high-contrast and visible
- [ ] Touch targets ≥ 44×44 (or expanded via padding)
- [ ] Any async action gives feedback within 400ms
- [ ] No `linear` curves except progress bars
- [ ] Enter ease-out, exit ease-in
- [ ] Exit faster than enter
- [ ] No critical info hidden behind hover-only
- [ ] `prefers-reduced-motion` honored
- [ ] No more than one focal animation per screen at a time
- [ ] Destructive actions confirmed; undoable actions toasted

## Drill-deeper queries

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book inclusive-components "focus keyboard"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book laws-of-ux "doherty fitts"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book about-face "interaction states"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts "loading skeleton spinner"
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book 100-things "response time perception"
```

---

## Motion language


Most AI-generated motion is scattered — hover lifts on every card, fade-in on every scroll, bouncing icons. Quiet it. One orchestrated moment beats ten small ones.

> For per-interaction recipes (button press, focus, modal, toast, optimistic update, command palette, drag handle, etc.), see [`microinteractions.md`](microinteractions.md). This file is the *language* of motion; that file is the *vocabulary*.

## Principles

- **Animate only `transform` and `opacity`.** These are GPU-composited; they don't trigger layout. Anything else is a performance bug waiting.
- **Duration is three buckets.** Micro (100–150ms), minor (200–300ms), major (300–500ms). Exits are ~75% of the enter.
- **Easing is exponential ease-out.** Elements coming in slow down into place. Elements leaving accelerate away.
- **Motion serves perception.** If you can't explain what a transition communicates, cut it.
- **Reduced motion is non-optional.** `@media (prefers-reduced-motion: reduce)` collapses all spatial motion to opacity crossfade.

## Easings

Use these three. Name them as tokens.

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);        /* elements entering */
  --ease-in:  cubic-bezier(0.7,  0, 0.84, 0);       /* elements leaving  */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);    /* state toggles     */
}
```

`ease`, `ease-in-out` (default), `cubic-bezier(0.25, 0.1, 0.25, 1)` — these are the browser defaults and they read as uncrafted.

## Durations

```css
:root {
  --dur-micro: 120ms;   /* button press, toggle tick, color shift  */
  --dur-short: 220ms;   /* hover lift, tooltip, menu open          */
  --dur-long:  420ms;   /* modal, drawer, accordion, page reveal   */
}
```

Exits use roughly 75% of the enter:

```css
.menu.is-open  { transition: transform var(--dur-short) var(--ease-out); }
.menu.is-close { transition: transform calc(var(--dur-short) * 0.75) var(--ease-in); }
```

## Page-load orchestration

One sequence on page load. Stagger by DOM index using a CSS custom property, not by JS.

```html
<section style="--i: 0">…</section>
<section style="--i: 1">…</section>
<section style="--i: 2">…</section>
```

```css
.reveal {
  opacity: 0;
  transform: translateY(8px);
  animation: reveal var(--dur-long) var(--ease-out) forwards;
  animation-delay: calc(var(--i, 0) * 60ms);
}
@keyframes reveal {
  to { opacity: 1; transform: none; }
}
```

Cap total stagger at ~500ms. Beyond that the page feels slow to settle.

## Scroll-linked motion

- Use IntersectionObserver, **never** `scroll` event listeners.
- Use it only for *reveal once* effects. No parallax. No scroll-scrubbed animations unless there is a specific reason.
- Every scroll-triggered motion must have a reduced-motion fallback.

## State transitions

- Button hover / active: micro duration, `--ease-out`, `transform: translateY(-1px)` on hover, `translateY(0)` on active. Never a `box-shadow` transition on hover on a dark background (glow effect).
- Menu / tooltip / dropdown: short duration, `--ease-out` on open, `--ease-in` on close. Use the popover API or `inert` to manage focus.
- Modal: long duration, scale-in (0.96 → 1) + opacity crossfade. Backdrop fades in at the same duration.
- Accordion: animate `grid-template-rows: 0fr` → `grid-template-rows: 1fr` (not `height`). With `--ease-in-out`.

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 150ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
  }
  .reveal { animation: reveal-reduced 150ms linear forwards; }
  @keyframes reveal-reduced { to { opacity: 1; transform: none; } }
}
```

Functional motion (progress bars, loading spinners, skeletons) still runs — just slower.

## Bans

- `ease` (browser default, mediocre).
- `linear` on anything except progress bars and ticking loaders.
- Bounce / elastic / overshoot on UI elements. Dated; signals "template".
- Animating `width`, `height`, `top`, `left`, `margin`, `padding`.
- `will-change` set preemptively across a whole class. Only on the element, only while it's animating.
- Parallax.
- Custom cursors.
- Scroll-driven animations without a reduced-motion fallback.
- Infinite loops (other than functional loaders) — they pull the eye and never let go.
