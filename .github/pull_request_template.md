## What changed and why

<!-- The why matters more than the what — the diff already shows the what. -->

## Test plan

- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] For a platform component: ran the review pipeline in `CLAUDE.md` (`code-simplifier` → `code-review` → layering/compliance checks as applicable)

## Non-negotiables check

If this touches routing, caching, isolation, data erasure, or orchestration — confirm it doesn't
contradict the Non-negotiables in `CLAUDE.md` before requesting review.
