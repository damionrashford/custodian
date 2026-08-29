# Issues — `gh issue`

Load when: any issue operation — triage, listing, creating, closing, labels, assignees, milestones, transfer between repos, develop branch from issue.

---

## Create

```bash
gh issue create                               # interactive
gh issue create --title 'X' --body 'Y'
gh issue create --title 'X' --body-file body.md
gh issue create --title 'X' --body 'Y' --label bug --label priority:high
gh issue create --title 'X' --body 'Y' --assignee '@me' --assignee alice
gh issue create --title 'X' --body 'Y' --milestone v1.0 --project 'Q1 Roadmap'
gh issue create --template bug_report.md      # use repo issue template

# Non-interactive (scripts/agents):
gh issue create \
  --title "Bug: something broke" \
  --body "$(cat <<'EOF'
**Steps to reproduce:**
1. ...

**Expected:** ...
**Actual:** ...
EOF
)" \
  --label bug --assignee '@me'
```

## List

```bash
gh issue list                                 # default: 30 open issues in current repo
gh issue list --state all --limit 200
gh issue list --state closed --limit 100
gh issue list --label bug
gh issue list --label bug --label 'good first issue'    # AND filter
gh issue list --assignee '@me' --state open
gh issue list --author alice
gh issue list --milestone v1.0
gh issue list --mention '@me'                 # issues mentioning you
gh issue list --search 'is:open no:assignee label:bug'  # any GitHub search syntax
gh issue list --search 'is:open updated:>=2026-01-01 sort:reactions-+1-desc'

# Scripting:
gh issue list --json number,title,labels,assignees,createdAt --jq '.[]'
gh issue list --state open --json number,labels --jq '.[] | select(any(.labels[]?; .name == "bug"))'
```

`gh issue list --json` (no value) prints all available JSON fields.

## View

```bash
gh issue view 42                              # current repo, issue #42
gh issue view 42 --web
gh issue view 42 --comments                   # include comments in output
gh issue view 42 --json title,state,labels,assignees,projectItems --jq .
```

Useful JSON fields:
- `number`, `title`, `body`, `state` (`OPEN`/`CLOSED`), `stateReason` (`COMPLETED`/`NOT_PLANNED`/`REOPENED`)
- `author.login`, `assignees[]`, `labels[].name`
- `milestone.title`, `milestone.dueOn`, `milestone.state`
- `projectItems[]`, `closedByPullRequestsReferences[]`
- `reactionGroups[]`, `comments[]`
- `url`, `createdAt`, `updatedAt`, `closedAt`

## Edit

```bash
gh issue edit 42 --title 'New title' --body 'New body'
gh issue edit 42 --body-file body.md
gh issue edit 42 --add-label bug --remove-label needs-triage
gh issue edit 42 --add-assignee '@me' --add-assignee alice --remove-assignee old-user
gh issue edit 42 --milestone 'v1.0'
gh issue edit 42 --remove-milestone
gh issue edit 42 --add-project 'Q1' --remove-project 'Old'
```

## Close & reopen

```bash
gh issue close 42                             # default reason: completed
gh issue close 42 --reason 'not planned'      # reasons: completed, "not planned"
gh issue close 42 --comment 'duplicate of #50'
gh issue reopen 42
gh issue reopen 42 --comment 'reverting close — still broken'
```

## Comment

```bash
gh issue comment 42 -b 'message'
gh issue comment 42 -F comment.md
gh issue comment 42 --edit-last -b 'updated'   # edit your most recent comment
```

## Develop (create branch from issue)

```bash
gh issue develop 42                           # creates issue-42-<slugified-title> from default branch
gh issue develop 42 --base develop            # branch from a non-default base
gh issue develop 42 --name custom-branch
gh issue develop 42 --checkout                # also switch to the new branch
gh issue develop 42 --list                    # list all branches linked to this issue
```

Linked branches show in the issue's GitHub sidebar and auto-link the PR to the issue when opened.

## Pin / unpin

```bash
gh issue pin 42                               # pin at top of issue list (max 3 per repo)
gh issue unpin 42
```

## Lock / unlock

```bash
gh issue lock 42 --reason resolved            # reasons: off-topic, too heated, resolved, spam
gh issue unlock 42
```

## Transfer

```bash
gh issue transfer 42 owner/other-repo         # move issue to another repo
                                              # requires triage/write access on BOTH repos
                                              # comments + linked PRs are preserved
```

## Delete (rarely what you want)

```bash
gh issue delete 42 --yes                      # DESTRUCTIVE — irreversible; requires admin
                                              # most users want `close` not `delete`
```

## Status

```bash
gh issue status                               # YOUR issues across all repos:
                                              #   - assigned to you
                                              #   - mentioning you
                                              #   - opened by you
```

## Common patterns

### "Triage: list unlabeled, unassigned open issues"

```bash
gh issue list --state open --search 'no:label no:assignee' --limit 100
```

### "Find all stale issues (no update in 90 days)"

```bash
gh issue list --state open --search 'updated:<2026-02-15' --limit 200
# Use $(date -v-90d +%Y-%m-%d) on macOS, $(date -d '90 days ago' +%Y-%m-%d) on Linux
```

### "Show issues blocking a milestone"

```bash
gh issue list --milestone 'v1.0' --state open --json number,title,assignees --jq '.[]'
```

### "Bulk-label issues matching a search"

```bash
gh issue list --search 'no:label is:open documentation in:title' --json number --jq '.[].number' \
  | xargs -I{} gh issue edit {} --add-label documentation
```

### "Re-assign all issues assigned to a leaving teammate to @me"

```bash
gh issue list --assignee old-user --state open --json number --jq '.[].number' \
  | xargs -I{} gh issue edit {} --add-assignee '@me' --remove-assignee old-user
```

### "Find issues fixed by a merged PR"

```bash
gh pr view 123 --json closingIssuesReferences --jq '.closingIssuesReferences[].number'
```

### "Issue → branch → PR in one flow"

```bash
gh issue develop 42 --checkout                # creates and switches to issue-42-<slug>
# ... do work, commit, push ...
gh pr create --fill --assignee '@me'          # PR auto-links to issue via branch name convention
```

## Closing an issue from a PR (no gh command — use git)

In your commit message or PR body, include:

```
Closes #42
Fixes #42
Resolves #42
```

When the PR merges to the default branch, the issue auto-closes. Cross-repo: `Closes owner/repo#42`.
