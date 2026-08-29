# Pull Requests — `gh pr`

Load when: the user asks about pull requests in any way — opening, reviewing, merging, checking out, viewing diff, status checks, comments, draft/ready, edit metadata.

---

## Create

```bash
gh pr create                                  # interactive: title, body, base, reviewers
gh pr create --title 'X' --body 'Y' --base main --head feature/x
gh pr create --fill                           # use commit subject + body for PR title/body
gh pr create --fill-first                     # use only the FIRST commit (good for single-commit PRs)
gh pr create --fill-verbose                   # include each commit's full message in the body
gh pr create --body-file pr-body.md
gh pr create --draft                          # open as draft
gh pr create --web                            # write body in browser instead of TUI
gh pr create --assignee '@me' --reviewer alice,bob --label bug
gh pr create --milestone v1.0 --project 'Q1 Roadmap'
gh pr create --template .github/pull_request_template.md
```

**Non-interactive recipe (for scripts / agents):**

```bash
gh pr create \
  --title "$(git log -1 --pretty=%s)" \
  --body "$(cat <<'EOF'
## Summary
- bullet
- bullet

## Test plan
- [ ] item
EOF
)" \
  --base main \
  --head "$(git branch --show-current)"
```

**Heredoc gotcha:** quoting `'EOF'` (with quotes) disables variable expansion inside the heredoc — use this when the body contains `$variables` or backticks that should appear literally.

## List

```bash
gh pr list                                    # default: 30 open PRs in current repo
gh pr list --state all --limit 200
gh pr list --state closed --limit 100
gh pr list --author '@me'
gh pr list --author alice
gh pr list --assignee '@me'
gh pr list --label bug --label 'good first issue'   # AND filter (must have both)
gh pr list --base main                        # PRs targeting main
gh pr list --head feature/                    # PRs from branches starting with feature/
gh pr list --draft                            # just drafts
gh pr list --search 'is:open review-requested:@me'   # any GitHub search syntax
gh pr list --search 'is:open updated:>2026-01-01'

# Scripting:
gh pr list --json number,title,author,headRefName,state,createdAt --jq '.[]'
gh pr list --json number,statusCheckRollup --jq '.[] | select(.statusCheckRollup[]?.conclusion == "FAILURE")'
```

`gh pr list --json` (no value) prints all available JSON fields for the command.

## View

```bash
gh pr view 123                                # current repo, PR #123
gh pr view <branch-name>                      # if branch matches a PR, show that PR
gh pr view --json title,state,mergeable,reviewDecision,mergeStateStatus --jq .
gh pr view 123 --web                          # open in browser
gh pr view 123 --comments                     # include comments in output
```

Useful JSON fields:
- `number`, `title`, `body`, `state` (`OPEN`/`CLOSED`/`MERGED`)
- `author.login`, `assignees[]`, `reviewRequests[]`, `labels[].name`
- `headRefName`, `baseRefName`, `headRepository.nameWithOwner`
- `mergeable` (`MERGEABLE`/`CONFLICTING`/`UNKNOWN`), `mergeStateStatus`
- `reviewDecision` (`APPROVED`/`CHANGES_REQUESTED`/`REVIEW_REQUIRED`)
- `statusCheckRollup[]` — each check's `name`, `conclusion`, `detailsUrl`
- `commits[]`, `files[]`, `reviews[]`, `comments[]`
- `url`, `createdAt`, `updatedAt`, `mergedAt`, `closedAt`

## Diff

```bash
gh pr diff 123                                # full unified diff
gh pr diff 123 --name-only                    # changed file names
gh pr diff 123 --patch                        # git-format patch (apply with `git am`)
gh pr diff 123 --color=always | less -R       # paged with color
```

## Checkout

```bash
gh pr checkout 123                            # creates/switches to local branch matching the PR
gh pr checkout 123 --recurse-submodules
gh pr checkout 123 --detach                   # checkout as detached HEAD instead of branch
gh pr checkout 123 --force                    # overwrite local branch if exists
gh pr checkout 123 -b custom-branch-name      # use a custom local branch name
```

For PRs from forks, `gh pr checkout` configures the remote correctly so subsequent `git pull`/`push` go to the right place.

## Checks (CI status)

```bash
gh pr checks                                  # current branch's PR
gh pr checks 123
gh pr checks 123 --watch                      # block until checks finish
gh pr checks 123 --watch --fail-fast          # exit nonzero as soon as one fails
gh pr checks 123 --required                   # only show required checks
gh pr checks 123 --json name,state,bucket,workflow,detailsUrl --jq '.[]'
```

Bucket values: `pass`, `fail`, `pending`, `skipping`, `cancel`.

## Status

```bash
gh pr status                                  # YOUR PRs across all repos:
                                              #   - assigned to you
                                              #   - review requested from you
                                              #   - opened by you
```

## Review

```bash
gh pr review 123 --approve
gh pr review 123 --approve -b 'LGTM'
gh pr review 123 --request-changes -b 'see comments'
gh pr review 123 --comment -b 'general comment'
gh pr review 123 --body-file review.md
```

To leave **inline review comments** (per-line), use the API:

```bash
gh api repos/{owner}/{repo}/pulls/123/reviews \
  -F event=COMMENT \
  -F 'comments[][path]=src/foo.ts' \
  -F 'comments[][line]=42' \
  -F 'comments[][body]=Consider extracting this.'
```

## Comment (top-level, not inline)

```bash
gh pr comment 123 -b 'looks good'
gh pr comment 123 -F comment.md
gh pr comment 123 --edit-last -b 'updated message'    # edit your last comment
```

## Edit metadata

```bash
gh pr edit 123 --title 'New title' --body 'New body'
gh pr edit 123 --body-file body.md
gh pr edit 123 --add-label bug --remove-label 'needs-triage'
gh pr edit 123 --add-reviewer alice,bob --remove-reviewer charlie
gh pr edit 123 --add-assignee '@me' --remove-assignee old-user
gh pr edit 123 --milestone 'v1.0' --remove-milestone
gh pr edit 123 --add-project 'Q1' --remove-project 'Old'
gh pr edit 123 --base develop                # change target branch
```

## Merge

```bash
gh pr merge 123                              # interactive: pick merge/squash/rebase
gh pr merge 123 --merge                      # merge commit
gh pr merge 123 --squash                     # squash + merge (one commit on base)
gh pr merge 123 --rebase                     # rebase + fast-forward

gh pr merge 123 --squash --delete-branch     # also delete head branch after merge
gh pr merge 123 --squash --subject 'fix: X' --body 'detail'   # custom commit message
gh pr merge 123 --squash --body-file commit-body.md

gh pr merge 123 --auto --squash              # enable auto-merge: merges when checks pass
gh pr merge 123 --disable-auto               # disable auto-merge

gh pr merge 123 --admin                      # bypass branch protection (requires admin scope)
```

**Auto-merge requires the repo to have auto-merge enabled in settings.**

## Ready / Draft

```bash
gh pr ready 123                              # draft → ready for review
gh pr ready 123 --undo                       # ready → draft
```

## Close / Reopen

```bash
gh pr close 123                              # close WITHOUT merging
gh pr close 123 --comment 'superseded by #200' --delete-branch
gh pr reopen 123
```

## Revert (creates a new PR that undoes a merged one)

```bash
gh pr revert 123                             # interactive
gh pr revert 123 --title 'Revert PR #123' --body 'reason'
gh pr revert 123 --draft                     # open the revert as a draft
```

## Update branch

```bash
gh pr update-branch 123                      # merge base into PR branch (resolves "out of date")
gh pr update-branch 123 --rebase             # rebase PR branch onto base instead of merging
```

## Lock / Unlock

```bash
gh pr lock 123 --reason resolved             # reasons: off-topic, too heated, resolved, spam
gh pr unlock 123
```

## Common patterns

### "Approve & merge the latest PR for my branch"

```bash
pr=$(gh pr view --json number --jq .number)
gh pr review $pr --approve -b 'LGTM'
gh pr merge $pr --squash --delete-branch
```

### "List PRs that need MY review right now"

```bash
gh pr list --search 'is:open review-requested:@me' --json number,title,url,author --jq '.[]'
```

### "Find PRs with failing checks"

```bash
gh pr list --state open --json number,title,statusCheckRollup \
  --jq '.[] | select(any(.statusCheckRollup[]?; .conclusion == "FAILURE")) | "#\(.number) \(.title)"'
```

### "Get the diff of a PR as a patch and apply it locally"

```bash
gh pr diff 123 --patch | git am
```

### "Find all PRs that touched a specific file"

```bash
gh search prs --repo owner/name 'file.ts in:title,body' --limit 50
# OR more precisely via api:
gh api -X GET search/issues -f q='repo:owner/name is:pr file.ts' --jq '.items[].html_url'
```