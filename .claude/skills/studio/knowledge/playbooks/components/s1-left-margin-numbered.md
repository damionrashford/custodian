
### S1 · Left-margin numbered
A numbered label (`01 — LABEL.`) heads the section; body-level content below may use a narrow left-margin column for micro-labels. **The label + heading stack in ONE column — never side by side** (slop gate 66 bans eyebrow-left / heading-right on the same row; the left-margin treatment is reserved for body rows, per layout.md § Asymmetry).
*Use when:* the page is editorial / specimen.
*Don't confuse with:* S5 Bottom-anchored (which puts the label *under* the section).

```html
<header class="head-numbered">
  <p class="num-label">01 — Foundations</p>
  <h2>…</h2>
</header>
<div class="row-margin"><p class="row-label">est. 2019</p><p>Body copy that may sit beside a micro-label…</p></div>
```
```css
/* head: single column, vertical stack — gate-66 compliant */
.head-numbered { display: grid; grid-template-columns: 1fr; gap: var(--space-2xs); }
.num-label { font-variant-caps: all-small-caps; letter-spacing: 0.1em; color: var(--color-muted); }
/* body rows MAY use the left-margin column: label + BODY copy only, never a heading */
.row-margin { display: grid; grid-template-columns: 10rem minmax(0, 1fr); gap: var(--space-xl); align-items: baseline; }
```
