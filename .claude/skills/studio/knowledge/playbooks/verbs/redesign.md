# `studio redesign`

The user wants a different page from the same content. They are not happy with the current visual structure — typically because it reads as templated, generic, or AI-shaped. Your job is to redesign the page's structure, rhythm, and component voice while respecting the existing implementation boundaries unless the user explicitly confirms a full rebuild.

## Non-destructive implementation rule

Studio redesigns visual and interaction layers. It does not delete production files by default.

- Never delete existing route files, component directories, page trees, or the old website unless the user explicitly asks for deletion or approves a file-level plan that lists the deletions.
- Default to in-place edits of the named page/component files, or additive new components/tokens wired through the existing route.
- If the redesign would require removing multiple components, replacing a route tree, or collapsing the app into a single new page, stop and ask for confirmation first.
- Treat PDFs, README files, `.md` briefs, docs, transcripts, and pitch decks as source material for understanding the product. They are not page copy by default. Summarize and adapt them unless the user explicitly says to use their wording verbatim.
- Before editing, state the files you expect to modify, create, and delete. Any deletion needs explicit confirmation.

## Step 0 · Detect scope first

Before anything else, decide whether the redesign is **single-page** or **multi-page**. The behaviour diverges hard.

**Multi-page signals (any one fires):**
- The target is a directory (e.g. `./app/`, `./pages/`, `./src/routes/`).
- The target is a glob (`**/*.tsx`, `app/*/page.tsx`).
- The user names more than one file in the brief (`./hero.tsx and ./pricing.tsx`).
- The user says "the whole site", "every page", "the app", "all the pages", "the marketing site".
- The codebase has multiple route files (`app/page.tsx`, `app/about/page.tsx`, `app/pricing/page.tsx`, etc.) and the user pointed at the project root.

If any of those fires → **multi-page redesign**. Go to § Multi-page flow.
If none fires → **single-page redesign**. Go to § Single-page flow.

---

## § Multi-page flow — design.md first, then redesign

A web app needs a *design system*, not seventeen unrelated theme pickings. Studio's diversification rule is wrong here: across pages of the same product, **consistency is the goal, not variety**. If you redesign every page with a different macrostructure / theme / accent, you've shipped a slop split-personality app, even if each individual page is fine.

The flow is:

### 1. Read the project, then pause

Before redesigning a single file:

- Walk the target directory. List every page-level file you found, with a one-line description of what it does. (Hero / pricing / docs / dashboard / etc.)
- Note any existing design assets: a `tokens.css`, a tailwind config with brand values, a logo, brand colours mentioned in `README`, a marketing screenshot.
- Check for an existing `.studio/log.json` — if it has prior runs, read the most recent stamp; if all those entries are different macrostructures / themes, it confirms the user's complaint.

### 2. Produce `design.md` at the project root

Write a single file at the project root: `design.md` (or `DESIGN.md` — match the project's existing case convention). This file is the **one source of truth** every subsequent page redesign reads. **Use the exact format + confirmation flow defined in [`design-md.md`](../design-md.md)** — state the picks aloud, wait for the user's confirmation, only then write the file and start redesigning pages.

### 3. Redesign each page reading from `design.md`

For each target page:

- **Read `design.md` first.** It is now the rule of the project; the per-build rule files in `knowledge/rules/` defer to it. Where `design.md` and the rules conflict, `design.md` wins (full lock semantics: [`design-md.md`](../design-md.md) § After the file is written).
- Pick the macrostructure from the family declared in `design.md` for this page's type (marketing / app / content). Within the family, you may vary archetypes — but only those `design.md` allows.
- Apply the locked theme. Do **not** swap to a different theme to "add variety". The variety lives in macrostructure / archetype choice, not theme.
- Apply the locked typography, spacing, motion, microinteractions stance.
- Stamp every page's CSS with: `/* Studio · genre: <genre> · macrostructure: <name> · design-system: design.md · designed-as-app */`. The `designed-as-app` flag tells future Studio runs to read `design.md`, not invent a new system.
- Write a single combined `.studio/log.json` entry for the multi-page redesign, with `"scope": "app"` instead of one entry per page.

### 4. Diversification rule — INVERTED for multi-page

Across pages of the same app, the diversification rule is *inverted*: consecutive pages MUST share theme, accent, type pairing. They may differ on macrostructure within the family. The slop-test gates that check "differs from previous Studio run" (9, 22, 34 of the 71) are skipped for `designed-as-app` outputs — the system overrides the catalog rotation here.

Pages that drift from `design.md` are slop. The audit verb flags `design.md` drift as a critical structural finding (`stamp-vs-design.md disagreement`).

### 5. When to amend `design.md` instead of overriding

If a page genuinely needs something `design.md` doesn't allow (e.g. a marketing landing for a new sub-product wants a different theme), the rule is **amend `design.md` first**, not override locally. Add an explicit per-page allowance or a `## Variants` section. The file evolves; per-page overrides do not.

---

## § Single-page flow

(The classic redesign behaviour — unchanged.)

**What to preserve:**
- The copy intent, factual claims, product names, and primary message. Preserve exact wording only when it already lives in the target UI or the user explicitly asks for verbatim copy.
- The information architecture (which sections exist, in roughly what order)
- The brand (colours and fonts they've named, if any)
- The primary action
- The existing route/component ownership boundaries, unless the user has approved a full rebuild

**What to replace:**
- The structural fingerprint — pick a **different** combination from [`structure.md`](../../rules/structure.md) than the source had.
- The component voice — different button style, different divider language, different image treatment.
- The reveal pattern — if the original faded everything in on scroll, the new one might have no reveals at all.
- The visual rhythm — different sections having different padding, different alignments, deliberate breaks.

**What not to replace without confirmation:**
- Route trees, production component directories, or the old website's file structure.
- Working app logic, data fetching, auth, forms, analytics, or integration code.
- Existing copy with pasted text from PDFs, docs, or markdown files unless the user requested verbatim copy.

**Optional `--mood <name>` argument:**

If the user specifies a mood (`studio redesign ./hero.tsx --mood luxury`), pick a tone aligned to that mood and let it drive the structural fingerprint. Mood names map to tones from [`typography.md`](../../rules/typography.md) and [`structure.md`](../../rules/structure.md). If no mood is given, ask the user what *feeling* they want — one word — and proceed.

**Genre escape hatch.** If the user explicitly asks for a *kind* of design that the current genre doesn't fit (e.g. "redesign this editorial page as a modern SaaS hero"), switch genre too. Load [`genres/<new-genre>.md`](../genres/) and apply its rule overlay. Stamp the new genre into the output so future runs respect it.

**Project-level check.** Before treating this as a true single-page redesign, look for `design.md` at the project root. If it exists, the project is being designed as an app and **the single-page rules don't apply** — read `design.md` and follow it instead. The diversification rule reverses (consistency wins). If you actually want to break from the locked system, *update `design.md` first*, then redesign.

**Output:**

Return the redesigned code, plus a short note explaining:

- The structural fingerprint you picked, axis by axis.
- Why this combination fits the brief better than the original.
- One thing you removed and why.
- (If genre changed) why the new genre fits the user's stated kind of design.
