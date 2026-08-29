# Repositories — `gh repo`

Load when: repo-level operations — creating, cloning, forking, viewing, editing settings, syncing forks, archiving, deletion, deploy keys, autolinks.

---

## Create

```bash
gh repo create                                # interactive
gh repo create my-repo --public --clone       # create + clone locally
gh repo create owner/name --private
gh repo create owner/name --internal          # internal (enterprise only)

# From existing local directory:
gh repo create owner/name --source=. --push --private
gh repo create owner/name --source=. --remote=origin

# From a template repo:
gh repo create owner/name --template owner/template-repo --public --clone

# With description / homepage / topics / gitignore / license:
gh repo create owner/name --public \
  --description 'A thing' \
  --homepage 'https://example.com' \
  --add-readme \
  --gitignore Node \
  --license MIT
```

## Clone

```bash
gh repo clone owner/name                      # clone via your configured git_protocol (ssh/https)
gh repo clone owner/name custom-dir
gh repo clone owner/name -- --depth 1         # pass-through args to git clone go after `--`
gh repo clone owner/name -- --branch develop --single-branch
gh repo clone owner/name -- --recurse-submodules

# Cloning a fork sets `upstream` to the parent automatically.
```

## View

```bash
gh repo view                                  # current repo
gh repo view owner/name
gh repo view owner/name --web
gh repo view --json nameWithOwner,description,visibility,defaultBranchRef,isPrivate,isArchived,licenseInfo --jq .
gh repo view --json url,homepageUrl,stargazerCount,forkCount --jq .
```

Useful JSON fields:
- Identity: `id`, `name`, `nameWithOwner`, `owner.login`
- Visibility: `visibility` (`PUBLIC`/`PRIVATE`/`INTERNAL`), `isPrivate`, `isFork`, `isInOrganization`, `isArchived`, `isTemplate`
- Branches: `defaultBranchRef.name`, `defaultBranchRef.target.oid`
- Settings: `hasIssuesEnabled`, `hasProjectsEnabled`, `hasWikiEnabled`, `hasDiscussionsEnabled`, `mergeCommitAllowed`, `squashMergeAllowed`, `rebaseMergeAllowed`, `autoMergeAllowed`, `deleteBranchOnMerge`
- Metadata: `description`, `homepageUrl`, `licenseInfo.spdxId`, `repositoryTopics[].topic.name`
- Counts: `stargazerCount`, `forkCount`, `watcherCount`, `issues.totalCount`, `pullRequests.totalCount`
- URLs: `url`, `sshUrl`, `httpUrl`
- Timestamps: `createdAt`, `updatedAt`, `pushedAt`

## Edit settings

```bash
gh repo edit                                  # interactive (current repo)
gh repo edit --description 'new description'
gh repo edit --homepage 'https://example.com'
gh repo edit --visibility private             # or public, internal
gh repo edit --default-branch develop

gh repo edit --enable-issues=false
gh repo edit --enable-wiki=false --enable-projects=false --enable-discussions=true

gh repo edit --allow-update-branch            # allow contributors to update PR branches
gh repo edit --enable-auto-merge

gh repo edit --enable-merge-commit=false      # control which merge methods are allowed
gh repo edit --enable-squash-merge=true
gh repo edit --enable-rebase-merge=false

gh repo edit --delete-branch-on-merge=true    # auto-delete head branches after merge

gh repo edit --add-topic foo --add-topic bar --remove-topic baz
```

## Fork

```bash
gh repo fork                                  # fork current repo into your account
gh repo fork --clone                          # also clone the fork locally
gh repo fork --remote                         # add the parent as `upstream` remote
gh repo fork owner/name --clone --remote
gh repo fork owner/name --org my-org          # fork into an org
gh repo fork --default-branch-only            # only mirror the default branch
gh repo fork --fork-name custom-name          # rename the fork
```

## Sync (fork ↔ upstream)

```bash
gh repo sync                                  # sync current fork's default branch with upstream
gh repo sync --branch develop                 # sync a non-default branch
gh repo sync owner/fork                       # sync someone else's fork (where you have push)
gh repo sync owner/fork --source another/repo --branch main
gh repo sync owner/fork --force               # force sync even if histories diverged
```

`gh repo sync` works server-side via the GitHub API — no local checkout needed. Equivalent to clicking "Sync fork" in the web UI.

## List

```bash
gh repo list                                  # your repos (default 30)
gh repo list my-org --limit 200
gh repo list my-org --visibility private --limit 100
gh repo list my-org --no-archived
gh repo list my-org --topic mcp --language go
gh repo list my-org --source                  # exclude forks
gh repo list my-org --fork                    # only forks
gh repo list my-org --json name,visibility,updatedAt,pushedAt --jq '.[]'
```

## Rename

```bash
gh repo rename new-name                       # rename current repo
gh repo rename --repo owner/old new           # rename a specific repo
                                              # GitHub auto-redirects the old URL
```

## Archive / unarchive

```bash
gh repo archive owner/name                    # mark read-only; preserves data
gh repo unarchive owner/name                  # restore writability
                                              # archived repos can't accept PRs/issues
```

## Delete (irreversible)

```bash
gh repo delete owner/name --yes               # requires `delete_repo` scope
                                              # NOT in default token; refresh first:
gh auth refresh -s delete_repo
gh repo delete owner/name --yes
```

**Never run without explicit user authorization for the specific repo.**

## Set-default

When the local repo has multiple git remotes (e.g. `origin` + `upstream`), `gh` may pick the wrong one for PRs/issues/etc.

```bash
gh repo set-default                           # interactive picker
gh repo set-default owner/name                # set non-interactively
gh repo set-default --view                    # show current default
gh repo set-default --unset                   # remove default config
```

The choice persists in `.git/config` under `[remote "<chosen>"] gh-resolved`.

## Autolinks

Autolinks turn references like `JIRA-123` into clickable links in issues/PRs/wikis.

```bash
gh repo autolink list
gh repo autolink view <id>
gh repo autolink create 'JIRA-' 'https://jira.example.com/browse/JIRA-<num>'
gh repo autolink create 'TICKET-' 'https://ticket.example.com/<num>' --numeric
gh repo autolink delete <id>
```

The URL template uses `<num>` as the placeholder for the matched number.

## Deploy keys

Deploy keys are SSH keys with read (or write) access to ONE repo (vs user SSH keys which span all repos).

```bash
gh repo deploy-key list
gh repo deploy-key add path/to/key.pub --title 'CI server'
gh repo deploy-key add path/to/key.pub --title 'CI server' --allow-write
gh repo deploy-key delete <key-id>
```

## Gitignore & license templates (read-only catalog)

```bash
gh repo gitignore list                        # all available templates
gh repo gitignore view Node                   # preview the Node gitignore

gh repo license list                          # all available licenses
gh repo license view MIT                      # preview MIT license text
```

Reference these from `gh repo create --gitignore <name>` and `--license <spdx>`.

## Common patterns

### "Create a private repo from local code in cwd"

```bash
gh repo create owner/new-repo --private --source=. --push \
  --description 'description' --add-readme=false
```

### "Bulk-archive abandoned repos in an org (older than 2 years, no recent push)"

```bash
gh repo list my-org --no-archived --limit 1000 \
  --json name,pushedAt,nameWithOwner \
  --jq '.[] | select(.pushedAt < "2024-05-16") | .nameWithOwner' \
  | xargs -I{} gh repo archive {} --yes
```

### "Find all repos using a specific topic"

```bash
gh repo list my-org --topic legacy --limit 200 --json nameWithOwner --jq '.[].nameWithOwner'
# Or globally:
gh search repos --topic mcp --limit 100 --json fullName --jq '.[].fullName'
```

### "Audit which repos have issues disabled"

```bash
gh repo list my-org --limit 1000 --json nameWithOwner,hasIssuesEnabled \
  --jq '.[] | select(.hasIssuesEnabled == false) | .nameWithOwner'
```

### "Clone all repos in an org"

```bash
gh repo list my-org --limit 1000 --json sshUrl --jq '.[].sshUrl' \
  | xargs -L1 git clone
```
