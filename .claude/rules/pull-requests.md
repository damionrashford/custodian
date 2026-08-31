# Pull Requests

> **Deliberately unscoped.** `paths:` triggers on the files Claude reads, and this governs a `gh`
> command *sequence* rather than a file. There is no edit whose target should remind you of the
> merge order.

Custodian ships in stages, and each stage branches off the previous one, so PRs stack. This file
records the order that works, because getting it wrong is silent and unrecoverable.

## The failure this prevents

`gh pr merge <n> --delete-branch` on a PR that is the **base** of another PR does not retarget the
child. GitHub **closes** it, and a PR whose base branch no longer exists cannot be reopened:

```
GraphQL: Cannot change the base branch of a closed pull request.
GraphQL: Could not open the pull request.
```

The work is not lost — the branch still exists — but the PR, its description and any review
history are gone, and the only recovery is opening a fresh PR.

## The order that works

1. **Retarget every child PR to `main` first**, while its current base still exists:
   ```bash
   for n in 3 4 5; do gh pr edit "$n" --base main; done
   ```
2. **Merge the base PR without `--delete-branch`:**
   ```bash
   gh pr merge 2 --merge
   ```
3. **Bring `main` into the next branch before merging it**, so its CI runs against what will
   actually land:
   ```bash
   git checkout stage-3 && git merge origin/main && bun run verify && git push
   ```
4. Repeat 2–3 down the stack. Delete branches **after** the whole stack has landed:
   ```bash
   git push origin --delete stage-2 stage-3 stage-4
   ```

## Two things to check before merging anything

- **CI actually ran.** A stacked PR targeting another stage gets no checks unless the workflow
  trigger has no branch filter. `tests/standards.test.ts` guards this now, but confirm with
  `gh pr checks <n>` rather than assuming — "no checks reported" is not a pass.
- **Merge, don't squash.** The per-task commit messages carry the reasoning for decisions recorded
  in `locked-decisions.md`. Squashing a stage into one commit discards it.

## Prefer not stacking this deep

Five deep was too many. The stack existed because nothing was merged for four stages, and each
extra level multiplies the rebase surface. Merge a stage once its gates are green rather than
accumulating; the review benefit of a small PR is lost anyway once it is buried under three others.
