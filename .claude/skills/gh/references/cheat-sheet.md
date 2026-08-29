# gh Cheat Sheet — Common Operations

Load when: you need day-to-day command syntax for PRs, issues, repos, basic api calls, or auth status.

---

## Auth & context

```bash
gh auth status                          # who am I? which host? which scopes?
gh auth login                           # interactive login (browser or token)
gh auth token                           # print the current token (useful for env vars)
gh repo view --json nameWithOwner,defaultBranchRef,isPrivate  # current repo context
gh repo set-default                     # pick a default when multiple remotes exist
```

## Pull requests

```bash
gh pr list                              # default: 30 open PRs in current repo
gh pr list --state all --limit 100      # broaden
gh pr list --author '@me' --state open
gh pr list --search 'is:open review-requested:@me'

gh pr create                            # interactive
gh pr create --title 'X' --body 'Y' --base main --head feature/x
gh pr create --fill                     # use commit message as title/body
gh pr create --draft                    # open as draft
gh pr create --web                      # open editor in browser instead of TUI

gh pr view 123                          # show one PR
gh pr view 123 --web                    # open in browser
gh pr view --json title,state,mergeable,reviewDecision --jq .

gh pr diff 123                          # full diff
gh pr diff 123 --name-only              # just filenames
gh pr diff 123 --patch                  # patch format

gh pr checkout 123                      # checkout PR locally as a branch
gh pr checkout 123 --recurse-submodules

gh pr checks 123                        # show CI status
gh pr status                            # PRs across repos (assigned, review-requested, mine)

gh pr review 123 --approve
gh pr review 123 --request-changes -b 'message'
gh pr review 123 --comment -b 'message'
gh pr review 123 --body-file review.md

gh pr merge 123                         # interactive: pick merge/squash/rebase
gh pr merge 123 --squash --delete-branch
gh pr merge 123 --merge
gh pr merge 123 --rebase --auto         # enable auto-merge once checks pass

gh pr close 123                         # WITHOUT merging
gh pr reopen 123
gh pr ready 123                         # mark draft as ready for review
gh pr update-branch 123                 # merge base branch into PR branch
gh pr comment 123 -b 'looks good'
gh pr comment 123 -F comment.md
gh pr edit 123 --title 'X' --body 'Y' --add-label bug --add-reviewer alice
```

## Issues

```bash
gh issue list                           # default: 30 open issues
gh issue list --label bug --state open --assignee '@me' --limit 100
gh issue list --search 'is:open milestone:"v1.0"'

gh issue create                         # interactive
gh issue create --title 'X' --body 'Y' --label bug --assignee alice

gh issue view 42
gh issue view 42 --web
gh issue view 42 --json title,state,labels,assignees --jq .

gh issue close 42
gh issue close 42 --comment 'fixed in #43'
gh issue reopen 42

gh issue comment 42 -b 'updated'
gh issue edit 42 --add-label bug --remove-label needs-triage --milestone v1.0
gh issue develop 42 --base main --checkout      # create feature branch from issue
gh issue transfer 42 owner/other-repo
gh issue pin 42 / unpin 42
gh issue lock 42 --reason resolved / unlock 42
gh issue status
```

## Repos

```bash
gh repo view                            # current repo
gh repo view owner/name                 # any repo
gh repo view owner/name --web

gh repo clone owner/name                # clones via configured protocol (ssh/https)
gh repo clone owner/name -- --depth 1   # extra args to git clone after `--`
gh repo clone owner/name custom-dir

gh repo create owner/name --public --clone
gh repo create owner/name --private --source=. --push    # init from local dir, push
gh repo create owner/name --template owner/template-repo

gh repo fork                            # fork current repo
gh repo fork owner/name --clone --remote
gh repo fork owner/name --org my-org

gh repo sync                            # sync current fork's default branch with upstream
gh repo sync owner/fork                 # sync a specific fork

gh repo edit --description 'new desc' --visibility private --enable-issues=false
gh repo rename new-name
gh repo archive owner/name              # mark archived (irreversible-ish)
gh repo unarchive owner/name

gh repo list owner --limit 100 --json name,visibility,updatedAt
gh repo list --topic mcp --limit 50
```

## Releases

```bash
gh release list
gh release view v1.0
gh release view v1.0 --json tagName,name,assets,publishedAt --jq .

gh release create v1.0 --title 'v1.0' --notes 'Initial release'
gh release create v1.0 --generate-notes
gh release create v1.0 --target main --draft
gh release create v1.0 ./dist/*.tar.gz   # attach assets

gh release upload v1.0 ./extra.zip
gh release download v1.0                # download all assets to cwd
gh release download v1.0 --pattern '*.tar.gz' --dir ./out
gh release delete v1.0 --yes            # destructive; requires --yes
```

## GitHub Actions

```bash
gh workflow list                        # all workflows
gh workflow view ci.yml
gh workflow view ci.yml --yaml          # source

gh workflow run ci.yml                  # trigger workflow_dispatch
gh workflow run ci.yml --ref main -f input1=value -f input2=value

gh workflow enable ci.yml / disable ci.yml

gh run list                             # last 30 runs across workflows
gh run list --workflow ci.yml --branch main --status failure --limit 50
gh run list --json databaseId,name,conclusion,createdAt --jq '.[]'

gh run view <run-id>
gh run view <run-id> --log              # full logs (large)
gh run view <run-id> --log-failed       # only logs from failed steps
gh run view <run-id> --job <job-id>     # specific job

gh run watch <run-id>                   # block until finish
gh run watch <run-id> --exit-status     # also exit nonzero if run failed
gh run watch                            # interactive picker

gh run rerun <run-id>                   # re-run entire run
gh run rerun <run-id> --failed          # only re-run failed jobs
gh run rerun <run-id> --job <job-id>    # one job

gh run cancel <run-id>
gh run delete <run-id>                  # destructive
gh run download <run-id>                # download all artifacts to cwd
gh run download <run-id> --name <artifact-name> --dir ./out
```

## `gh api` — the universal escape hatch

```bash
# REST GET
gh api repos/{owner}/{repo}/issues
gh api repos/{owner}/{repo}/issues --jq '.[].title'
gh api repos/{owner}/{repo}/issues --paginate --jq '.[].number'

# REST POST/PATCH with parameters
gh api repos/{owner}/{repo}/issues/123/comments -f body='hello from gh'
gh api repos/{owner}/{repo}/issues/123 -X PATCH -F state='closed'

# Custom header
gh api -H 'Accept: application/vnd.github.v3.raw+json' repos/{owner}/{repo}/contents/README.md

# GraphQL
gh api graphql -f query='query { viewer { login } }'
gh api graphql -F owner='{owner}' -F name='{repo}' -f query='
  query($owner: String!, $name: String!) {
    repository(owner:$owner, name:$name) { defaultBranchRef { name } }
  }
'
```

Full power (placeholders, --template, --paginate semantics, GraphQL pagination): see `api.md`.

## Gists

```bash
gh gist create file.txt --public --desc 'demo'
gh gist create file.txt --filename other.txt
echo 'inline' | gh gist create --filename note.md
gh gist list
gh gist view <id>
gh gist edit <id>
gh gist clone <id> dest-dir
gh gist delete <id>
```

## Labels & projects (quick reference)

```bash
gh label list
gh label create bug --color BF0000 --description 'Bug report'
gh label clone owner/source-repo                       # copy labels from another repo

gh project list --owner @me
gh project view <number> --owner @me
gh project item-list <number> --owner @me --limit 100
```

## Secrets & variables

```bash
gh secret list                                         # repo secrets
gh secret list --env production                        # environment secrets
gh secret list --org my-org                            # org secrets
gh secret set MY_KEY                                   # prompts for value (more secure)
gh secret set MY_KEY -b "value"                        # inline (visible in shell history!)
gh secret set MY_KEY < secret.txt
gh secret delete MY_KEY

gh variable list
gh variable set NAME --body 'value'
gh variable delete NAME
```

## Search

```bash
gh search repos --owner anthropic --topic mcp --limit 50
gh search issues 'is:open label:bug' --repo owner/name
gh search prs --author '@me' --state open
gh search code 'function fetchAll' --language ts
gh search commits 'fix: race condition' --author '@me'
```

## Browse

```bash
gh browse                               # open current repo in browser
gh browse 123                           # open issue/PR #123
gh browse --branch feature
gh browse path/to/file.ts
gh browse --commit <sha>
gh browse --settings
gh browse --projects
```

## Status

```bash
gh status                               # check GitHub service status (incidents, maintenance)
```
