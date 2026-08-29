---
name: gh
description: >
  Use BEFORE running ANY gh command or answering ANY GitHub CLI question — reach for this skill instead of recalling gh syntax from training memory. Master the GitHub CLI: PRs, issues, repos, releases, GitHub Actions (workflow/run), gh api for arbitrary REST + GraphQL, auth and tokens, gists, codespaces, projects, secrets, labels. Sourced from the official cli.github.com/manual. Triggers when the user mentions gh, GitHub CLI, opens or reviews a PR, creates or closes an issue, uses gh api or gh api graphql, inspects a GitHub Actions run, manages GitHub auth, or asks about scopes, tokens, hosts, or any gh subcommand.
argument-hint: "[gh question or operation]"
allowed-tools: Bash(gh *)
---

# Gh — GitHub CLI

**Context:** $ARGUMENTS

## Quick start

- **Don't know the syntax?** → load `references/cheat-sheet.md`.
- **PR work (create / list / view / review / merge / checks)?** → load `references/pr.md`.
- **Issue work (create / list / triage / close)?** → load `references/issue.md`.
- **Repo lifecycle (create / clone / fork / delete / edit / sync)?** → load `references/repo.md`.
- **`gh api` or `gh api graphql` — anything not covered by a porcelain subcommand?** → load `references/api.md` (this is the most powerful and most under-used part of gh).
- **GitHub Actions (`gh workflow`, `gh run`, downloading artifacts, watching runs)?** → load `references/actions.md`.
- **Authentication, scopes, tokens, hosts, enterprise, switching accounts?** → load `references/auth.md`.
- **Need a command not in the cheat sheet?** → load `references/commands.md`.
- **About to run anything destructive (delete repo, delete secret, close PR, etc.)?** → load `references/gotchas.md` AND confirm with user.

## When to use

- Before running ANY `gh` command — gh has grown 100+ subcommands across pr/issue/repo/release/workflow/run/api/auth/codespace/project/etc; recall from training is fuzzy.
- Before answering "how do I X with the GitHub CLI?" — never quote subcommand syntax from memory without checking `cheat-sheet.md`, `commands.md`, or the relevant per-domain reference first.
- When the user wants to script GitHub data ("list all PRs", "find issues with label X", "download artifacts from run Y") — `gh api` with `--jq`, `--template`, `--paginate` is almost always the right answer over hand-rolled curl.
- Before doing anything irreversible: `gh repo delete`, `gh release delete`, `gh secret delete`, `gh variable delete`, `gh pr close`, `gh run delete`, `gh codespace delete`, `gh extension remove`.

## Step 1 — Check auth and repo context before acting

Run these read-only commands first. Operating without confirming context is how you push to the wrong fork or PR against the wrong base.

```bash
gh auth status                          # are we logged in? which host? which scopes? which account?
gh repo view --json nameWithOwner,defaultBranchRef,isPrivate  # repo context (current working dir's repo)
gh repo set-default                     # if multiple remotes — pick the one gh should default to
```

If `gh auth status` reports missing scopes for the operation you're about to do, load `references/auth.md` for the scope-refresh recipe.

## Step 2 — Identify the operation category and load ONE reference

Match the user's request to a category. Load only the matching reference file.

| User's request involves… | Load |
|---|---|
| Looking up common command syntax (pr create, issue list, repo clone, api basics) | `references/cheat-sheet.md` |
| A gh subcommand not in the cheat sheet, or "what does `gh X` do" | `references/commands.md` |
| Pull requests: create, list, view, diff, review, merge, checkout, checks, status, update-branch, comment | `references/pr.md` |
| Issues: create, list, view, close, comment, edit, label, pin, transfer, develop branch | `references/issue.md` |
| Repos: create, clone, fork, view, edit, delete, sync, archive, set-default, autolinks, deploy keys | `references/repo.md` |
| Arbitrary REST/GraphQL via `gh api` — pagination, jq, templates, field types, GH placeholders | `references/api.md` |
| GitHub Actions: workflow list/view/run/enable/disable, run list/view/download/cancel/rerun/watch | `references/actions.md` |
| Auth: login, logout, status, refresh scopes, switch account, GH_TOKEN, GH_HOST, enterprise | `references/auth.md` |
| Anything that "feels off" — rate limits, pagination silently truncating, JSON output quirks, gh confused about repo context | `references/gotchas.md` |

## Step 3 — Prefer `gh api` over building things from scratch

When no porcelain subcommand covers the operation (e.g. branch protection rules, repo collaborators, custom properties, organization audit log, project v2 mutations), reach for `gh api` rather than declaring "not possible." Load `references/api.md` for placeholder substitution (`{owner}/{repo}`), `--jq` filtering, `--paginate`, `--template` formatting, and GraphQL examples.

## Step 4 — Verify, then act

After loading the reference, restate the plan in one line — including destructive flags and which repo/host it targets. For destructive operations, confirm with the user before proceeding.

## Resources

References (load only the file matching the current task):

- `${CLAUDE_SKILL_DIR}/references/cheat-sheet.md` — load when you need common day-to-day command syntax: pr create/view/list/merge, issue create/view, repo clone, gh api basics, auth status.
- `${CLAUDE_SKILL_DIR}/references/commands.md` — load when you need a command not in the cheat sheet, want to know whether a subcommand exists, or need the one-line description for any gh subcommand in any group.
- `${CLAUDE_SKILL_DIR}/references/pr.md` — load when the user asks about pull requests in any way: opening, reviewing, merging, checking out, viewing diff, status checks, comments, draft/ready, edit metadata.
- `${CLAUDE_SKILL_DIR}/references/issue.md` — load for any issue operation: triage, listing, creating, closing, labels, assignees, milestones, transfer between repos, develop branch from issue.
- `${CLAUDE_SKILL_DIR}/references/repo.md` — load for repo-level operations: creating new repos, forking, cloning, editing settings, syncing forks, archiving, deletion, deploy keys, autolinks.
- `${CLAUDE_SKILL_DIR}/references/api.md` — load when using `gh api`, `gh api graphql`, or whenever you need an API endpoint with no dedicated porcelain command. This covers placeholders, field types (-F/-f), --jq, --template, --paginate, --slurp, GraphQL pagination patterns.
- `${CLAUDE_SKILL_DIR}/references/actions.md` — load for GitHub Actions: listing/triggering workflows, watching runs, downloading artifacts, re-running failed jobs, cancelling, viewing logs.
- `${CLAUDE_SKILL_DIR}/references/auth.md` — load for authentication: login flow, scope management, multiple accounts, GH_TOKEN vs `gh auth`, GH_HOST for GitHub Enterprise, `gh auth setup-git` for git credential helper.
- `${CLAUDE_SKILL_DIR}/references/gotchas.md` — always load alongside any destructive operation. Also load when something seems unexpectedly weird: pagination cap, JSON field name mismatch, "no such repo" with multi-remote setups, rate limit confusion, env var precedence.

## Gotchas

These rules ALWAYS apply. Don't override them without explicit user approval.

- **The user is already authenticated.** Per CLAUDE.md, `gh` is auth'd locally. Don't suggest `gh auth login` unless `gh auth status` actually shows missing/invalid auth. If a command fails due to scope, run `gh auth refresh -s <scope>` — load `references/auth.md`.
- **`gh repo delete` is irreversible AND non-trivially scoped.** Requires the `delete_repo` scope (not in default token). NEVER run this without explicit user authorization for the specific repo name. Same applies to `gh release delete`, `gh secret delete`, `gh variable delete`, `gh codespace delete`, `gh run delete`.
- **`gh pr close` ≠ `gh pr merge`.** `close` discards without merging. `merge` integrates. Don't confuse them. `gh pr merge --delete-branch` also deletes the source branch after merging.
- **Default `--limit` is 30 for most list commands.** `gh pr list`, `gh issue list`, `gh repo list`, `gh run list` all default to 30 items. If the user asks "list all" or "find X," explicitly pass `--limit <N>` or use `gh api --paginate` for unbounded sets. Silently returning 30 is a footgun.
- **JSON output is your friend — use `--json field,field --jq '.[].field'` for scripting.** Never parse human-formatted output. Every list/view command supports `--json` with a field list; `gh <cmd> --json` (no value) prints available fields. Pair with `--jq` for inline filtering.
- **`gh api` placeholders only fill from the *current* repo or `GH_REPO` env var.** `{owner}` and `{repo}` are NOT shell-expanded — they're literal strings that gh substitutes. If you're in `/tmp` with no git context, the substitution fails. Either `cd` to a repo, set `GH_REPO=owner/repo`, or write the path literally.
- **`gh api --paginate` only works for endpoints that return arrays AND respect REST pagination headers.** For GraphQL, you must construct your query with `$endCursor: String` and a `pageInfo { hasNextPage, endCursor }` block — see `references/api.md`. Single-object endpoints don't paginate; check the GitHub API docs.
- **`GH_TOKEN` env var overrides `gh auth`.** If `GH_TOKEN` is set, gh uses it INSTEAD of the keychain-stored token from `gh auth login`. This silently changes which account you're acting as. Check `gh auth status` and `env | grep GH_` before debugging "wrong user" issues.
- **Repo context detection trips on multi-remote forks.** If the local repo has both `origin` (your fork) and `upstream` (the original), `gh` may pick the wrong one. Run `gh repo set-default` once per repo to pin the default, or pass `--repo owner/name` explicitly.
- **`gh pr create` opens an interactive prompt by default.** For non-interactive use (scripting, CI, agents), pass `--title`, `--body`, `--base`, `--head` explicitly. To suppress the browser opening at the end: `--web=false` is the default for non-tty; if you're inside a tty you may want `gh pr create ... --no-edit-on-error` or just script with all required flags.
- **`gh release create` requires a tag.** If the tag doesn't exist yet, gh creates it. If it does, gh uses it. Be precise about `--target` (commit/branch the tag should point at), `--generate-notes` (auto-generate release notes from commits), `--prerelease`, `--draft`. Bad release tags propagate to npm/cargo/etc.
- **`gh run watch` blocks until the run finishes.** Useful for "wait for CI then continue" but can hang for hours if the run is queued. Pair with `--exit-status` so the command returns nonzero if the run failed, enabling `gh run watch && next-thing`.
- **Pagination of `gh api` with `--paginate` concatenates JSON arrays into one big array** for `application/json` endpoints — BUT only for endpoints whose body is a top-level array. For object endpoints, use `--slurp` to wrap multiple page-responses into a JSON array of objects. Mixing modes silently produces malformed output.

## Examples

### Example 1: "List all open PRs in this repo, with title, author, and URL"

Steps:
1. `gh auth status && gh repo view --json nameWithOwner`
2. Load `references/pr.md` for `gh pr list` field names.
3. Default limit is 30. To get ALL: pass an explicit large limit OR paginate via `gh api`.
4. ```bash
   gh pr list --state open --limit 1000 --json number,title,author,url --jq '.[] | "#\(.number) \(.title) by \(.author.login) — \(.url)"'
   ```
5. For unbounded sets in big repos: `gh api repos/{owner}/{repo}/pulls --paginate --jq '.[] | select(.state == "open") | {number, title, user: .user.login, url: .html_url}'`.

### Example 2: "What scopes does my current gh token have?"

Steps:
1. `gh auth status` — shows host, account, scopes.
2. If something's missing: `gh auth refresh -s <scope1>,<scope2>` (e.g. `-s delete_repo,write:packages`).
3. Load `references/auth.md` for the full scope catalog.

### Example 3: "Watch the latest workflow run on this branch and tell me if it passes"

Steps:
1. ```bash
   gh run list --branch $(git branch --show-current) --limit 1 --json databaseId --jq '.[0].databaseId'
   ```
2. Pipe into `gh run watch <id> --exit-status`.
3. Or in one shot: `gh run watch $(gh run list --branch $(git branch --show-current) --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status`
4. Load `references/actions.md` for more.

### Example 4: "Get the list of files changed in PR #123"

Steps:
1. `gh pr diff 123 --name-only` — quick path.
2. Or via api: `gh api repos/{owner}/{repo}/pulls/123/files --jq '.[].filename'`.
3. Load `references/pr.md` or `references/api.md`.

## Troubleshooting

### Error: "gh auth: token has insufficient scopes"

Cause: operation needs a scope not granted to the current token (common for `repo:delete`, `workflow`, `write:packages`, `admin:org`).
Solution: `gh auth refresh -h <host> -s <missing-scope>`. Reference: `auth.md`.

### Error: "could not determine default repository"

Cause: cwd has no git remote, has multiple remotes and no default set, or `GH_REPO` is unset.
Solution: `cd` to a git repo with a configured remote, OR run `gh repo set-default`, OR `export GH_REPO=owner/name`, OR pass `--repo owner/name` to every command.

### Error: "GraphQL: API rate limit exceeded"

Cause: too many requests in the rate-limit window (5000/hr authenticated for REST, 5000 points/hr for GraphQL).
Solution: `gh api rate_limit` to inspect; wait, or batch with `--paginate` smartly. Reference: `gotchas.md`.

### Error: "HTTP 422: Validation Failed" on `gh pr create`

Cause: usually no commits exist between `head` and `base`, OR the base branch doesn't exist on the remote, OR a PR already exists from this head.
Solution: `git log <base>..<head> --oneline` to verify diverging commits; `gh pr list --state all --head <branch>` to check for existing PR.

### Error: "no commits between <base> and <head>"

Cause: you haven't pushed the feature branch yet, or the branch is at the same commit as base.
Solution: `git push -u origin <branch>`, verify with `git log origin/<base>..origin/<branch>`.