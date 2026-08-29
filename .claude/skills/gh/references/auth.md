# Authentication — `gh auth` + tokens + scopes + hosts

Load when: authenticating, refreshing scopes, switching accounts, using GH_TOKEN / GH_HOST, configuring git credential helper, or working with GitHub Enterprise.

---

## Status — check before debugging

```bash
gh auth status                                # all hosts, all accounts
gh auth status --hostname github.com          # one host only
gh auth status --active                       # only the active account on each host
gh auth status --show-token                   # ALSO print the token (don't paste publicly)
```

Output identifies:
- Host (`github.com` or enterprise)
- Account (login)
- Token source (`keyring` / `oauth_token` / `GH_TOKEN` env var)
- Token scopes (`repo, workflow, ...`)
- Active state (which account `gh` will use by default)

---

## Login

```bash
gh auth login                                          # interactive (recommended)
gh auth login --hostname github.com                    # specify host
gh auth login --hostname github.example.com --git-protocol ssh --web    # enterprise
gh auth login --hostname github.com --git-protocol https --web
gh auth login --with-token < token.txt                 # non-interactive (CI/scripts)
echo "$MY_PAT" | gh auth login --with-token
gh auth login --scopes 'workflow,read:org,write:packages'   # request extra scopes upfront
gh auth login --skip-ssh-key                           # skip SSH key upload prompt
```

**Token storage:**
- macOS: stored in Keychain (`gh:github.com` entry)
- Linux: `~/.config/gh/hosts.yml` (mode 0600); also `secret-tool`/`gnome-keyring` when available
- Windows: Credential Manager

When `--with-token` is used, gh writes the token to the host config; no keyring interaction.

---

## Logout

```bash
gh auth logout                                # interactive
gh auth logout --hostname github.com          # one host
gh auth logout --user alice                   # one account on whatever host
```

---

## Refresh — change or expand scopes

This is the most-used "fix" command. When a `gh` operation errors with "token has insufficient scopes" or "must have admin rights" or "Resource not accessible by integration", you usually need to refresh with more scopes.

```bash
gh auth refresh                                              # re-auth current scopes
gh auth refresh -h github.com -s delete_repo                 # add ONE scope
gh auth refresh -h github.com -s workflow,write:packages     # add multiple
gh auth refresh -h github.com -s admin:org,admin:public_key  # admin scopes
gh auth refresh --reset-scopes                               # reset to gh's default set
gh auth refresh --remove-scopes admin:org                    # explicitly drop scope
```

After refresh, verify with `gh auth status` and confirm the new scopes appear.

---

## Switch accounts

If multiple accounts on the same host are logged in:

```bash
gh auth switch                                # interactive picker
gh auth switch --hostname github.com --user alice
gh auth status --active                       # confirm which account gh now uses
```

`gh auth switch` updates the active account in the host config; subsequent commands use it until you switch again or set `GH_TOKEN`.

---

## Token — print the active OAuth/PAT

```bash
gh auth token                                 # default host
gh auth token --hostname github.example.com   # enterprise
gh auth token --user alice                    # specific account
```

Useful for piping into other tools:

```bash
git -c http.extraHeader="Authorization: bearer $(gh auth token)" fetch ...
docker login ghcr.io -u USERNAME -p "$(gh auth token)"
curl -H "Authorization: bearer $(gh auth token)" https://api.github.com/user
```

---

## `gh auth setup-git` — git credential helper

Configures git to use `gh` as a credential helper, so `git push`/`git clone` over HTTPS authenticate automatically.

```bash
gh auth setup-git                                 # all hosts
gh auth setup-git --hostname github.com
gh auth setup-git --hostname github.example.com   # enterprise
gh auth setup-git --force                         # overwrite existing helper config
```

What it does (writes to your global `.gitconfig`):

```ini
[credential "https://github.com"]
	helper =
	helper = !/opt/homebrew/bin/gh auth git-credential

[credential "https://gist.github.com"]
	helper =
	helper = !/opt/homebrew/bin/gh auth git-credential
```

The first `helper =` (empty value) resets any inherited helpers; the second points to gh.

---

## Scope catalog (what each scope unlocks)

| Scope | Unlocks |
|---|---|
| `repo` | full control of private repos (clone, push, create, manage issues/PRs/releases, manage hooks) |
| `repo:status` | commit status (read+write) only |
| `repo_deployment` | deployment status only |
| `public_repo` | full access to PUBLIC repos only (no private) |
| `repo:invite` | accept/decline repo invites |
| `security_events` | code-scanning / secret-scanning alerts |
| `workflow` | update GitHub Actions workflow files (required for `gh workflow run` on workflows you're editing) |
| `write:packages` | upload packages to GitHub Packages (Docker, npm, Maven, NuGet, etc.) |
| `read:packages` | download packages |
| `delete:packages` | delete packages |
| `admin:org` | full control of orgs + teams; required for org-level audit log, org secrets |
| `write:org` | publicize/unpublicize org membership |
| `read:org` | read org / team membership |
| `admin:public_key` | full SSH-key management on your account (required for `gh ssh-key add/delete`) |
| `write:public_key` | add/list SSH keys (subset of admin:public_key) |
| `read:public_key` | list keys only |
| `admin:repo_hook` | full control of repo webhooks |
| `admin:org_hook` | full control of org webhooks |
| `gist` | create / edit / delete gists |
| `notifications` | read / mark notifications |
| `user` | read/write all profile data |
| `read:user` | read profile only |
| `user:email` | read your email addresses |
| `user:follow` | follow / unfollow other users |
| `delete_repo` | delete repos (required for `gh repo delete`) |
| `write:discussion` | manage discussions |
| `read:discussion` | read discussions |
| `admin:enterprise` | full enterprise admin (rare) |
| `admin:gpg_key` | full GPG key management |
| `codespace` | create / manage your codespaces |
| `project` | manage classic GitHub Projects (NOTE: Projects v2 uses `read:project`/`write:project` via the GraphQL API + the modern auth model — usually included in `repo`) |
| `audit_log` | read enterprise audit log |
| `copilot` | use GitHub Copilot |

**gh's default scopes after `gh auth login --web` include `repo, read:org, gist, workflow`.** Most other scopes you'll add later via `gh auth refresh -s <scope>`.

---

## Env vars

| Var | Effect | Precedence |
|---|---|---|
| `GH_TOKEN` | Use this token instead of the keyring entry | Overrides `gh auth` |
| `GITHUB_TOKEN` | Same as `GH_TOKEN` (fallback when `GH_TOKEN` unset) | Overrides `gh auth` |
| `GH_HOST` | Default host for commands that don't specify one | Overrides repo context detection |
| `GH_ENTERPRISE_TOKEN` | Token for the enterprise host (when both github.com + enterprise are auth'd) | |
| `GITHUB_ENTERPRISE_TOKEN` | Same as above (fallback) | |
| `GH_REPO` | Default repo (`owner/name`) when cwd has no git remote | |
| `GH_CONFIG_DIR` | Override config directory (default: `~/.config/gh`) | |
| `GH_EDITOR` / `EDITOR` | Editor for body composition | |
| `GH_PAGER` / `PAGER` | Pager for output (e.g. `less -R`) | |
| `GH_PROMPT_DISABLED` | Disable all interactive prompts | |
| `GH_BROWSER` / `BROWSER` | Browser to open with `--web` flags | |
| `GH_NO_UPDATE_NOTIFIER` | Suppress update-available notices | |
| `NO_COLOR` | Disable colored output | |
| `CLICOLOR_FORCE` | Force colored output even when piped | |
| `GH_DEBUG=api` | Print full HTTP request/response for every command (debugging) | |

---

## `GH_TOKEN` precedence gotcha

If `GH_TOKEN` (or `GITHUB_TOKEN`) is set in the environment, `gh` uses it INSTEAD of the keyring token from `gh auth login`. This silently changes which account / scopes you're acting as.

Symptoms:
- "Wrong" account name appears in PR / issue authorship
- Operations fail with scopes you thought you had
- `gh auth status` shows the token came from `GH_TOKEN` env var instead of keyring

Diagnose:

```bash
env | grep -E '^(GH_|GITHUB_)'
gh auth status                                # shows "Token: ************************" + source
```

Fix:

```bash
unset GH_TOKEN GITHUB_TOKEN                   # use keyring token
# OR explicitly point env tokens at the right account:
export GH_TOKEN=$(gh auth token --user alice)
```

---

## GitHub Enterprise

```bash
# Login to enterprise host
gh auth login --hostname github.example.com --git-protocol https --web

# Set as default for shell
export GH_HOST=github.example.com

# Or pass per-command
gh --hostname github.example.com pr list
gh repo view enterprise-org/repo --hostname github.example.com

# Operating on multiple hosts in one session:
gh auth status                                # see all hosts
gh repo view --repo github.com/cli/cli        # explicit github.com
gh repo view --repo github.example.com/x/y    # explicit enterprise
```

The host config lives in `~/.config/gh/hosts.yml`. Multiple hosts are supported simultaneously; commands that need a host either get one from `--hostname`, from `GH_HOST`, from the cwd's git remote URL, or fall back to the default (`github.com`).

---

## Config (not auth, but related)

```bash
gh config list                                # all settings
gh config get editor                          # one setting
gh config set editor vim                      # set
gh config set --host github.com git_protocol ssh    # per-host
gh config set browser firefox

# Per-host config (separate from auth) lives in ~/.config/gh/hosts.yml
# Global config in ~/.config/gh/config.yml

# Common knobs:
gh config set prompt disabled                 # never prompt interactively
gh config set pager 'less -R'
gh config set git_protocol ssh                # default to ssh URLs for gh repo clone
```

---

## Troubleshooting auth

### "HTTP 401 Bad credentials"

Token invalid or expired.

```bash
gh auth status                                # is the token recognized?
gh auth refresh                               # re-auth with current scopes
# If GH_TOKEN env var is set and stale, unset it:
unset GH_TOKEN GITHUB_TOKEN
```

### "HTTP 403 Resource not accessible by integration"

Token lacks the scope required, OR you're using GITHUB_TOKEN from inside an Actions runner which has reduced permissions (the runner token is per-workflow, not the user's PAT).

```bash
gh auth status                                # check current scopes
gh auth refresh -s <missing-scope>            # add the scope
```

### "must have admin rights" or "must have write access"

You're authenticated but lack repo permissions — not a token issue, an account-permission issue. Either get added to the repo, or operate on a different repo.

### "Token has not been granted the required scopes"

Same as 403 above — refresh with the scope listed in the error message.

### Auth succeeds but operations target the wrong account

Check `GH_TOKEN`/`GITHUB_TOKEN` env vars. If set, they override `gh auth`. See the precedence section above.

### Browser doesn't open during `gh auth login --web`

```bash
gh auth login --web --skip-browser            # gh prints the URL; open it manually
# Or pre-set the browser:
gh config set browser firefox
```

---

## Useful patterns

### "Make a fresh PAT scope-equivalent to my gh login"

```bash
gh auth token                                 # print active token
# OR via API:
gh api user                                   # confirms which account the token belongs to
gh api repos/{owner}/{repo}/actions/permissions   # confirms scope is sufficient for a specific repo
```

### "Audit which accounts I have logged in"

```bash
gh auth status                                # human format
gh auth status --json                         # programmatic (if supported by your gh version)
cat ~/.config/gh/hosts.yml                    # raw config
```

### "Rotate a stale PAT"

```bash
# 1. Generate new PAT at https://github.com/settings/tokens (or use gh auth login --web)
# 2. Update gh:
gh auth login --with-token < new-token.txt
# 3. Verify:
gh auth status
gh api user --jq .login
```

### "Use a separate token in CI without polluting the user's keyring"

```bash
# In CI, set GH_TOKEN — gh uses it without touching keyring
export GH_TOKEN="$CI_GITHUB_TOKEN"
gh pr list                                    # uses CI token
unset GH_TOKEN                                # done — keyring token resumes
```

### "Confirm the token has a scope before running a destructive op"

```bash
required="delete_repo"
if ! gh auth status 2>&1 | grep -q "$required"; then
  echo "Missing scope: $required"
  gh auth refresh -s "$required"
fi
```
