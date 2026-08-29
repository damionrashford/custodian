# Full gh Command Reference

Load when: you need a subcommand not in the cheat sheet, want to know whether a command exists, or need the one-line description for any gh subcommand. Sourced from https://cli.github.com/manual/.

For any command, run `gh <cmd> --help` for full flag documentation.

---

## Core

| Command | Description |
|---|---|
| `gh auth login` | Authenticate with your GitHub account |
| `gh auth logout` | Sign out |
| `gh auth refresh` | Refresh credentials (use `-s scope` to add scopes) |
| `gh auth setup-git` | Configure Git to use GitHub CLI as a credential helper |
| `gh auth status` | Check auth status (host, account, scopes) |
| `gh auth switch` | Switch between authenticated accounts |
| `gh auth token` | Print the active auth token |
| `gh api` | Make authenticated HTTP requests to the GitHub API (REST + GraphQL) |
| `gh browse` | Open a repo / file / issue / PR in the browser |
| `gh completion` | Generate shell completion scripts |
| `gh help reference` | Open the full command reference |
| `gh status` | Check GitHub service status (incidents, maintenance) |

## Repository

| Command | Description |
|---|---|
| `gh repo create` | Create a new repo (interactive or with `--source`/`--template`) |
| `gh repo clone` | Clone a repo (pass git args after `--`) |
| `gh repo view` | Show a repo's metadata / README |
| `gh repo edit` | Modify repo settings (visibility, description, features, default branch) |
| `gh repo fork` | Fork a repo |
| `gh repo list` | List repos for a user / org |
| `gh repo rename` | Rename a repo |
| `gh repo set-default` | Pick the default repo when multiple git remotes are present |
| `gh repo sync` | Sync a fork's default branch with upstream |
| `gh repo archive` / `unarchive` | Archive (read-only) or restore a repo |
| `gh repo delete` | Delete a repo (irreversible; requires `delete_repo` scope) |
| `gh repo autolink create/delete/list/view` | Manage autolink references |
| `gh repo deploy-key add/delete/list` | Manage deploy keys |
| `gh repo gitignore list/view` | List or view a `.gitignore` template |
| `gh repo license list/view` | List or view a license template |

## Pull requests

| Command | Description |
|---|---|
| `gh pr create` | Open a new pull request |
| `gh pr list` | List PRs (default 30; filter with `--state`, `--author`, `--label`, `--search`) |
| `gh pr view` | Show one PR (use `--json` for scripting, `--web` to open in browser) |
| `gh pr diff` | Show the PR diff (add `--name-only` or `--patch`) |
| `gh pr checkout` | Check out a PR's head branch locally |
| `gh pr checks` | Show CI check results for a PR |
| `gh pr status` | Show YOUR PRs (assigned, review-requested, mine) across repos |
| `gh pr review` | Approve / request changes / comment on a PR |
| `gh pr comment` | Add a top-level comment |
| `gh pr edit` | Change PR title, body, labels, reviewers, milestone, base, draft state |
| `gh pr merge` | Merge a PR (interactive merge/squash/rebase choice unless `--squash`/`--merge`/`--rebase`) |
| `gh pr close` | Close WITHOUT merging |
| `gh pr reopen` | Reopen a closed PR |
| `gh pr ready` | Convert a draft PR to ready-for-review |
| `gh pr revert` | Open a PR that reverts a merged PR |
| `gh pr lock` / `unlock` | Lock or unlock discussion |
| `gh pr update-branch` | Merge base into PR branch (resolve "out of date" warnings) |

## Issues

| Command | Description |
|---|---|
| `gh issue create` | Open a new issue |
| `gh issue list` | List issues (default 30; filter with `--label`, `--assignee`, `--state`, `--search`) |
| `gh issue view` | Show one issue (`--web` opens in browser) |
| `gh issue close` / `reopen` | Close (with optional `--comment`) or reopen |
| `gh issue comment` | Add a comment |
| `gh issue edit` | Modify title, body, labels, assignees, milestone, project |
| `gh issue delete` | DELETE an issue (irreversible — most users want `close`) |
| `gh issue develop` | Create a branch attached to an issue (`--checkout` to switch) |
| `gh issue transfer` | Move an issue to another repo |
| `gh issue pin` / `unpin` | Pin (or unpin) issue at top of issue list |
| `gh issue lock` / `unlock` | Lock or unlock discussion |
| `gh issue status` | Show YOUR issues across repos |

## Releases

| Command | Description |
|---|---|
| `gh release create` | Create a release; attach files as arguments; `--generate-notes` for auto notes |
| `gh release list` | List releases |
| `gh release view` | Show one release (`--web` opens in browser) |
| `gh release edit` | Modify a release (notes, name, draft/prerelease state) |
| `gh release upload` | Add assets to an existing release |
| `gh release download` | Download release assets (`--pattern '*.tar.gz'`, `--dir`) |
| `gh release delete` | DELETE a release (does not delete the tag — use `git tag -d` for that) |
| `gh release delete-asset` | Remove one asset from a release |
| `gh release verify` / `verify-asset` | Verify release / asset signatures (attestations) |

## GitHub Actions — workflows & runs

| Command | Description |
|---|---|
| `gh workflow list` | List workflows |
| `gh workflow view` | Show a workflow (add `--yaml` for source) |
| `gh workflow run` | Manually trigger a `workflow_dispatch` workflow (`-f input=value`) |
| `gh workflow enable` / `disable` | Enable or disable a workflow |
| `gh run list` | List recent runs (filter `--workflow`, `--branch`, `--status`, `--user`) |
| `gh run view` | Show one run (`--log` full, `--log-failed` failed steps only, `--job` for one job) |
| `gh run watch` | Block until run finishes (add `--exit-status` for nonzero on failure) |
| `gh run rerun` | Re-run a run (`--failed` for only failed jobs, `--job <id>` for one job) |
| `gh run cancel` | Cancel a run |
| `gh run delete` | Delete a run |
| `gh run download` | Download artifacts (`--name` for one, `--dir` for output path) |

## Gists

| Command | Description |
|---|---|
| `gh gist create` | Create a gist from file(s) or stdin |
| `gh gist list` | List your gists |
| `gh gist view` | Show one gist (`--web`, `--raw`) |
| `gh gist edit` | Modify a gist |
| `gh gist clone` | Clone a gist as a git repo |
| `gh gist rename` | Rename a file within a gist |
| `gh gist delete` | Delete a gist |

## Labels

| Command | Description |
|---|---|
| `gh label list` | List labels in repo |
| `gh label create` | Create a label (`--color`, `--description`) |
| `gh label edit` | Modify a label |
| `gh label delete` | Delete a label |
| `gh label clone` | Copy labels from another repo |

## Projects (v2)

| Command | Description |
|---|---|
| `gh project list` | List projects (`--owner @me` or `--owner my-org`) |
| `gh project view` | Show one project |
| `gh project create` / `edit` / `close` / `copy` / `delete` | Manage projects |
| `gh project mark-template` | Mark project as a template |
| `gh project field-create` / `field-delete` / `field-list` | Manage custom fields |
| `gh project item-add` | Link an existing issue/PR to a project |
| `gh project item-create` | Create a draft item directly in a project |
| `gh project item-list` / `item-edit` / `item-delete` / `item-archive` | Manage items |
| `gh project link` / `unlink` | Link/unlink an issue or PR to/from a project |

## Search

| Command | Description |
|---|---|
| `gh search repos` | Search repos (filters: `--owner`, `--topic`, `--language`, `--stars`) |
| `gh search code` | Search code in repos |
| `gh search issues` | Search issues across repos |
| `gh search prs` | Search PRs across repos |
| `gh search commits` | Search commits |

## Secrets, variables, keys

| Command | Description |
|---|---|
| `gh secret list` / `set` / `delete` | Manage repo / env / org secrets (`--env`, `--org`) |
| `gh variable list` / `get` / `set` / `delete` | Manage repo / env / org variables |
| `gh ssh-key add` / `list` / `delete` | Manage SSH keys on your account |
| `gh gpg-key add` / `list` / `delete` | Manage GPG keys on your account |

## Codespaces

| Command | Description |
|---|---|
| `gh codespace create` | Create a codespace |
| `gh codespace list` | List your codespaces |
| `gh codespace view` | Show details |
| `gh codespace code` | Open in VS Code (or `--web` for browser editor) |
| `gh codespace ssh` | SSH into a codespace |
| `gh codespace stop` / `delete` / `edit` / `rebuild` | Manage lifecycle |
| `gh codespace cp` | Copy files to/from a codespace |
| `gh codespace ports` / `ports forward` / `ports visibility` | Manage forwarded ports |
| `gh codespace logs` | View codespace logs |
| `gh codespace jupyter` | Open Jupyter in a codespace |

## Configuration & cache

| Command | Description |
|---|---|
| `gh config set` / `get` / `list` | Manage config (editor, pager, prompt, git_protocol, browser, etc.) |
| `gh config clear-cache` | Clear gh's response cache |
| `gh cache list` / `delete` | Manage GitHub Actions cache for a repo |

## Aliases & extensions

| Command | Description |
|---|---|
| `gh alias set <name> '<expansion>'` | Create command alias (e.g. `gh alias set co 'pr checkout'`) |
| `gh alias list` / `delete` / `import` | Manage aliases |
| `gh extension install <repo>` | Install an extension |
| `gh extension list` / `remove` / `upgrade` / `search` / `browse` | Manage extensions |
| `gh extension create` | Scaffold a new extension |
| `gh extension exec <name> [args...]` | Run an extension command |

## Verification & rulesets

| Command | Description |
|---|---|
| `gh attestation download` / `verify` / `trusted-root` | Manage signed-build attestations |
| `gh ruleset list` / `view` / `check` | Manage / verify repo & org rulesets |

## Help topics

| Topic | Run |
|---|---|
| Environment variables | `gh help environment` |
| Exit codes | `gh help exit-codes` |
| Output formatting (`--json`, `--jq`, `--template`) | `gh help formatting` |
| Telemetry | `gh help telemetry` |
| Full reference | `gh help reference` |

---

## How to discover

- `gh` — top-level help, lists command groups.
- `gh <command>` — group help (e.g. `gh pr` lists all pr subcommands).
- `gh <command> <sub> --help` — full flag documentation.
- `gh <command> <sub> --json` — when run with no value, prints available JSON fields for that command's output.
- `gh help reference` — opens the full searchable manual.
- `gh extension search <keyword>` — find community extensions that add new commands under `gh <name>`.
