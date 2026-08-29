# gh Gotchas — Things That Will Bite

Load when: paired with destructive operations OR when something seems unexpectedly weird — silent truncation, JSON field mismatches, repo-context confusion, rate limits, env var precedence.

---

## Destructive command catalog

These commands cause irreversible (or hard-to-reverse) data loss. Run only with explicit user authorization for the specific target.

| Command | What it destroys | Required scope | Safer alternative |
|---|---|---|---|
| `gh repo delete <owner/name>` | The whole repo + all issues/PRs/wiki/Actions history | `delete_repo` | `gh repo archive` (preserves data, marks read-only) |
| `gh release delete <tag>` | Release + attached assets (tag itself stays) | `repo` | `gh release edit --draft` |
| `gh release delete-asset <tag> <asset>` | One release asset | `repo` | Re-upload from backup; no other path |
| `gh secret delete <name>` | A secret (any workflow depending on it breaks instantly) | `repo` (`admin:org` for org secrets) | `gh secret set <name>` to rotate, then `delete` after deploys cut over |
| `gh variable delete <name>` | An Actions variable | `repo` | Same as secret |
| `gh ssh-key delete <id>` | One SSH key on your account | `admin:public_key` | None — verify by `gh ssh-key list` first |
| `gh gpg-key delete <id>` | One GPG key on your account | `admin:gpg_key` | None |
| `gh run delete <run-id>` | A workflow run + its artifacts | `repo` | Just leave it; runs are cheap |
| `gh cache delete <cache-id>` | One Actions cache | `repo` | Caches expire automatically after 7 days |
| `gh codespace delete <name>` | A codespace + any uncommitted work in it | `codespace` | `gh codespace stop` (suspends; can resume) |
| `gh codespace rebuild <name>` | Codespace container (preserves /workspaces but kills running processes) | `codespace` | None — but warn the user before |
| `gh pr close <num>` | Closes WITHOUT merging — comments/reviews preserved but PR can be reopened | `repo` | `gh pr ready --undo` to revert to draft instead |
| `gh issue delete <num>` | Issue + all comments + linked PR references (irreversible, requires admin) | repo admin | `gh issue close` (preserves history) |
| `gh gist delete <id>` | Gist + revision history | `gist` | None |
| `gh repo edit --visibility private --enable-issues=false` | Disabling issues hides existing ones (data preserved but inaccessible until re-enabled) | `repo` | Confirm with owner |
| `gh repo edit --default-branch <X>` | Changes default; PRs targeting old default still work but new branches default elsewhere | `repo` | Migrate intentionally; check branch protection rules first |
| `gh extension remove <name>` | Removes installed extension (config in `~/.config/gh/extensions/` lost) | none | `gh extension upgrade` first if you just want a fresh install |

**Never run without explicit user authorization for the specific target name.**

---

## Default `--limit` is 30 — silent truncation

`gh pr list`, `gh issue list`, `gh repo list`, `gh run list`, `gh release list` all default to **30 items**. If the user asks "list all" or "find every X," 30 may be wildly insufficient. Worse: there's no warning when results are truncated.

Fix patterns:

```bash
# Bound explicitly:
gh pr list --limit 1000

# True unbounded — use the API with --paginate:
gh api repos/{owner}/{repo}/pulls --paginate --jq '.[] | {number, title, state}'

# Test for truncation: compare reported count vs --limit:
n=$(gh pr list --limit 1000 --json number --jq 'length')
echo "Got $n PRs (limit 1000 — if 1000 exactly, may be truncated)"
```

---

## `--json` (no value) lists available fields

When you don't know which JSON field names a command supports, run it with `--json` and no value:

```bash
gh pr view --json
# Specify one or more comma-separated fields:
#   additions, assignees, author, autoMergeRequest, baseRefName, body, ...
```

This is the canonical way to discover field names. Don't guess.

---

## `gh api` placeholders are not shell expansion

`{owner}`, `{repo}`, `{branch}` are LITERAL strings that gh substitutes server-side. Common confusion:

```bash
# WORKS — placeholders substituted from current repo context
gh api repos/{owner}/{repo}/issues

# Also WORKS — explicit values (no substitution needed)
gh api repos/cli/cli/issues

# DOES NOT WORK in PowerShell — braces need quoting/escaping
gh api 'repos/{owner}/{repo}/issues'        # quote to prevent PS brace expansion

# DOES NOT WORK if cwd has no git remote and GH_REPO is unset
cd /tmp && gh api repos/{owner}/{repo}/issues
# → "could not determine default repository"
# Fix: GH_REPO=cli/cli gh api repos/{owner}/{repo}/issues
```

---

## `GH_TOKEN` env var overrides `gh auth login`

If `GH_TOKEN` (or `GITHUB_TOKEN`) is set, gh uses it INSTEAD of the token from `gh auth login`. This silently changes which account / scopes you have. See `auth.md` for the precedence + fix.

```bash
env | grep -E '^(GH|GITHUB)_TOKEN'   # debug
unset GH_TOKEN GITHUB_TOKEN          # fall back to keyring
```

---

## Multi-remote repos confuse `gh`

If the local repo has multiple git remotes (e.g. `origin` = your fork, `upstream` = the canonical), `gh` doesn't know which one to target. Symptoms:

- "could not determine default repository"
- `gh pr list` shows PRs from the wrong repo
- `gh pr create` opens PR against your fork instead of upstream

Fix once per repo:

```bash
gh repo set-default                  # interactive picker
gh repo set-default upstream-owner/repo
gh repo set-default --view           # show what's currently set
```

Persists in `.git/config` under `[remote "<name>"] gh-resolved`.

---

## `gh pr close` ≠ `gh pr merge`

- `gh pr close <num>` — closes the PR WITHOUT merging. Comments/reviews preserved. Can be reopened.
- `gh pr merge <num>` — integrates the PR. Picks merge / squash / rebase interactively unless `--squash` / `--merge` / `--rebase` is specified.

Never confuse them. Don't infer intent from "I'm done with this PR" — ask whether it merged or not.

---

## `gh pr merge --delete-branch` deletes the source branch

```bash
gh pr merge 123 --squash --delete-branch    # merges + deletes the head branch on remote
                                            # local copy of the branch remains; clean up with:
                                            #   git branch -d <branch-name>
```

If the head branch is on a fork, the deletion targets the fork's branch (works only if you have push access to the fork).

---

## Auto-merge requires repo setting

```bash
gh pr merge 123 --auto --squash
# May fail with: "auto-merge is not allowed for this repository"
```

Fix: ask the user to enable Allow auto-merge in repo settings (Settings → General → "Allow auto-merge"). Then re-run.

---

## `gh run watch` can hang forever on queued runs

```bash
gh run watch <id>   # blocks until status == completed
                    # if the run is stuck in queued / waiting (e.g. waiting for self-hosted runner),
                    # this hangs indefinitely
```

Mitigations:

```bash
# Timeout with `timeout` (GNU coreutils / `gtimeout` on macOS via brew install coreutils):
timeout 600 gh run watch <id> --exit-status
# OR poll manually:
while [ "$(gh run view <id> --json status --jq .status)" != "completed" ]; do sleep 10; done
```

---

## REST `--paginate` vs GraphQL pagination

- **REST `--paginate`** works for endpoints returning a top-level JSON array AND respecting the `Link: <next>` header. For object-response endpoints (like `search/issues` which returns `{total_count, items}`), use `--jq '.items[]'` to flatten OR `--slurp` to keep page boundaries.
- **GraphQL pagination** is NOT automatic. Your query must accept `$endCursor: String` and fetch `pageInfo { hasNextPage, endCursor }`. See `api.md` for the canonical pattern.
- Mixing modes (using `--paginate` without `--slurp` on object endpoints) silently produces invalid output.

---

## Rate limits

GitHub enforces:
- **REST:** 5,000 requests/hour per authenticated user (60/hr unauthenticated)
- **GraphQL:** 5,000 "points" per hour (each query costs ≥1 point; complex queries cost more)
- **Search API:** 30 requests/min authenticated (10/min unauthenticated) — much stricter
- **Secondary rate limits** trigger on burst activity even when you're under the primary limit

Check current state:

```bash
gh api rate_limit --jq '.resources'
gh api rate_limit --jq '.resources.core | "core: \(.remaining)/\(.limit), reset at \(.reset | strftime("%H:%M:%S"))"'
gh api rate_limit --jq '.resources.search | "search: \(.remaining)/\(.limit), reset at \(.reset | strftime("%H:%M:%S"))"'
gh api rate_limit --jq '.resources.graphql | "graphql: \(.remaining)/\(.limit), reset at \(.reset | strftime("%H:%M:%S"))"'
```

If hit: wait until reset OR batch via `--paginate` smartly (one paginated call consumes one slot per page, but is rate-limit-friendlier than many separate calls).

---

## `gh api` exit code is `0` on 2xx only

Non-2xx HTTP status (including 404 Not Found) makes `gh api` exit nonzero AND print the API error body to stdout. Be careful with shell pipelines:

```bash
# If endpoint returns 404, this script keeps going with empty/invalid input:
gh api repos/x/nonexistent | jq .name        # jq errors on invalid JSON

# Guard with set -e or explicit check:
if ! out=$(gh api repos/x/nonexistent 2>&1); then
  echo "API call failed: $out" >&2
  exit 1
fi
```

---

## `gh pr checkout` from a fork modifies your git config

When checking out a PR from a fork, `gh pr checkout` adds a remote for the fork (typically named after the fork's owner) and configures the local branch to track it. This is usually what you want, but means subsequent `git push` goes to the contributor's fork — verify before pushing.

```bash
gh pr checkout 123
git remote -v                                # check for new remote
git config branch.<branch>.remote            # see where push goes
```

To unconfigure:

```bash
git config --unset branch.<branch>.remote
git remote remove <fork-owner>
```

---

## `gh pr create` failure modes

```bash
gh pr create --base main --head feature
```

| Error | Cause | Fix |
|---|---|---|
| `no commits between main and feature` | You haven't pushed feature yet, or the branch is at the same commit as base | `git push -u origin feature` then verify with `git log origin/main..origin/feature` |
| `a pull request for branch "feature" already exists` | You're trying to create a duplicate PR | `gh pr view --head feature` to find the existing one |
| `HTTP 422 Validation Failed` | One of the above, plus possible mismatches like nonexistent base, branch permissions | Check `--head` is pushed, base exists on remote |
| `field 'baseRefName' must not be blank` | `--base` not specified and current repo has no detectable default | Explicit `--base main` |

---

## `gh repo create` from local: `--source` + `--push` semantics

```bash
gh repo create owner/name --private --source=. --push
```

- `--source=.` reads the cwd as the source git repo (must already be `git init`'d).
- `--push` pushes the current branch to the new remote.
- Without `--source`, gh creates a bare remote and (with `--clone`) clones it locally.
- If cwd has uncommitted changes, they DON'T push — only committed history pushes. Stage + commit first.

---

## JSON output uses **camelCase**, the API uses **snake_case**

When using `gh <cmd> --json fieldName`, the field name is camelCase. When using `gh api`, the response body is snake_case (matching the GitHub API spec).

```bash
gh pr view --json mergeable,headRefName,baseRefName    # camelCase
gh api repos/{owner}/{repo}/pulls/123 | jq '.mergeable_state, .head.ref, .base.ref'    # snake_case
```

Don't confuse these. They're different representations even though they return the same underlying data.

---

## `gh search` is rate-limited harder than `gh api`

Both go through GitHub's search API. Search is 30 req/min authenticated. `gh search repos`/`gh search issues`/etc. all share this budget. Heavy scripted use will hit limits fast.

---

## `gh extension install` runs arbitrary code

Extensions are scripts/binaries from GitHub repos. `gh extension install owner/gh-extension-name` clones the repo and runs its install scripts. Vet before installing — same scrutiny as `npm install -g` or `brew install`.

```bash
gh extension list                            # what's currently installed
gh extension remove <name>                   # uninstall
```

---

## `gh config set` doesn't validate

```bash
gh config set editor 'not-a-real-editor'    # accepted; fails at use time
gh config set pager nonsense                # same
```

After setting, run `gh config list` to verify, and exercise the changed command (e.g. `gh issue create` to test editor).

---

## Pager interferes with piping

By default `gh` pipes long output through `less` when stdout is a tty. When redirecting to a file or another command, the pager is bypassed — usually correct. But if you want predictable output in scripts:

```bash
GH_PAGER='' gh pr list        # disable pager for one command
gh config set pager ''        # disable globally
```

---

## `--web` opens browser — useless in headless environments

Many commands have a `--web` flag that opens the resource in a browser. In CI, SSH sessions without X-forwarding, or agents, this either errors or silently does nothing. Always have a non-`--web` fallback:

```bash
gh pr view 123 --web                  # opens browser — won't work headless
gh pr view 123 --json url --jq .url   # prints URL — works everywhere
```

---

## `gh` reads from `git remote` — not from cwd absolute path

If you `cd ~/projects/A` but the cwd's git remote points at `github.com/owner/B`, `gh` operates on B, not A. Always verify with `gh repo view --json nameWithOwner` before acting.
