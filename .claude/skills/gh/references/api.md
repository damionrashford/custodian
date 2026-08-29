# `gh api` — Arbitrary REST + GraphQL

Load when: using `gh api`, `gh api graphql`, or whenever you need a GitHub API endpoint with no dedicated porcelain command. This file is sourced verbatim from <https://cli.github.com/manual/gh_api>.

---

## Synopsis

```bash
gh api <endpoint> [flags]
```

- `<endpoint>` is either a REST path (e.g. `repos/{owner}/{repo}/issues`) or the literal string `graphql` for the v4 API.
- Default HTTP method is `GET` (or `POST` when any `-F`/`-f` parameters are added). Override with `-X`/`--method`.

---

## Placeholder substitution

`{owner}`, `{repo}`, and `{branch}` in the endpoint are replaced from the current repo context — same context resolution as every other `gh` command. If cwd has no git remote and `GH_REPO` is unset, substitution fails. Workarounds:

```bash
# 1. cd into a repo
cd /path/to/repo && gh api repos/{owner}/{repo}/issues

# 2. set GH_REPO env var
GH_REPO=cli/cli gh api repos/{owner}/{repo}/issues

# 3. write the path literally
gh api repos/cli/cli/issues

# 4. pass --repo (works for most gh commands, not gh api directly — use GH_REPO or literal path instead)
```

**Note:** `{owner}/{repo}` are not shell glob expansions; quote them or escape the braces in PowerShell.

---

## Flags (full list)

| Flag | Purpose |
|---|---|
| `--cache <duration>` | Cache the response (e.g. `60m`, `3600s`, `1h`). Subsequent identical calls in that window skip the network. |
| `-F, --field <key=value>` | **Typed** parameter. Booleans (`true`/`false`), `null`, integers convert to JSON types. Values starting with `@` read from file; `@-` reads from stdin. |
| `-f, --raw-field <key=value>` | **String** parameter (no type conversion). |
| `-H, --header <key:value>` | Add HTTP request header. Repeatable. |
| `--hostname <string>` | Target GitHub host (default: `github.com`). For GitHub Enterprise: `--hostname github.example.com`. |
| `-i, --include` | Include HTTP status line + response headers in output. |
| `--input <file>` | Send file contents as request body. Use `"-"` for stdin. Field flags become query-string params instead of body when `--input` is given. |
| `-q, --jq <expr>` | Filter response through jq inline (no separate `\| jq` needed). |
| `-X, --method <verb>` | HTTP method override: `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `HEAD`. |
| `--paginate` | Fetch all pages and concatenate. REST: top-level arrays merged into one. GraphQL: requires `$endCursor` + `pageInfo` in query. |
| `-p, --preview <names>` | Opt into API previews; adds `Accept: application/vnd.github.<name>-preview+json` header. Repeatable or comma-separated. |
| `--silent` | Suppress response body output (still propagates exit code). |
| `--slurp` | With `--paginate`, wrap multiple page-responses into one JSON array. Required when each page returns an object (not an array). |
| `-t, --template <expr>` | Format output with Go template syntax. Supports `pluck`, `join`, `color`, etc. |
| `--verbose` | Print full HTTP request + response (headers + body). For debugging. |

---

## Parameters: `-F` (typed) vs `-f` (string)

```bash
# -F: type-converts
gh api endpoint -F count=42         # JSON {"count": 42}        — int
gh api endpoint -F enabled=true     # JSON {"enabled": true}    — bool
gh api endpoint -F draft=false      # JSON {"draft": false}     — bool
gh api endpoint -F parent=null      # JSON {"parent": null}     — null

# -F: file/stdin via @
gh api endpoint -F body=@body.md    # contents of body.md as string
echo 'hello' | gh api endpoint -F body=@-

# -F: placeholder substitution
gh api endpoint -F owner='{owner}'  # substitutes from current repo

# -f: always a string
gh api endpoint -f tag=v1.2.3       # JSON {"tag": "v1.2.3"}
gh api endpoint -f body=true        # JSON {"body": "true"}     — string literal "true"
```

**When to use which:**
- Use `-F` when the API expects a typed JSON value (boolean, integer, null, or file content).
- Use `-f` when the API expects a string, especially for values that *look* like booleans/numbers but should stay as strings (e.g. tag names like `"v1.0"`, ref names like `"true"`, version numbers).

---

## Nested parameters

```bash
# Nested object: key[subkey]=value
gh api gists -F 'files[my-file.txt][content]=@my-file.txt'
# → {"files": {"my-file.txt": {"content": "<file contents>"}}}

# Array of values: key[]=value (repeatable)
gh api endpoint -F 'labels[]=bug' -F 'labels[]=urgent'
# → {"labels": ["bug", "urgent"]}

# Empty array: key[]
gh api endpoint -F 'labels[]'
# → {"labels": []}

# Array of nested objects:
gh api -X PATCH /orgs/{org}/properties/schema \
  -F 'properties[][property_name]=environment' \
  -F 'properties[][default_value]=production' \
  -F 'properties[][allowed_values][]=staging' \
  -F 'properties[][allowed_values][]=production'
```

---

## Request body via `--input`

When you have a pre-constructed JSON body (or want to send non-JSON), use `--input`:

```bash
# JSON file as body
gh api repos/{owner}/{repo}/rulesets --input ruleset.json

# Build JSON inline + pipe
jq -n '{name: "main", target: "branch", rules: []}' \
  | gh api repos/{owner}/{repo}/rulesets --input -

# Mix: --input for body, -F/-f for query string
gh api 'search/issues?q=is:open' --input filter.json -X GET
```

When `--input` is given, `-F`/`-f` flags add to the **query string**, not the body.

---

## Headers and previews

```bash
# Custom Accept header (e.g. fetch raw file content)
gh api -H 'Accept: application/vnd.github.v3.raw+json' \
  repos/{owner}/{repo}/contents/README.md

# Opt into API previews (auto-sets Accept header)
gh api --preview baptiste,nebula <endpoint>
# equivalent to: -H 'Accept: application/vnd.github.baptiste-preview+json, application/vnd.github.nebula-preview+json'
```

---

## Hostname / GitHub Enterprise

```bash
gh api --hostname github.example.com user
# Or set persistently for the shell:
export GH_HOST=github.example.com
gh api user
```

---

## Filtering with `--jq`

`--jq` runs the response through `jq` inline. Saves piping and works in cmd.exe / PowerShell.

```bash
# Just the titles
gh api repos/{owner}/{repo}/issues --jq '.[].title'

# Filter then format
gh api repos/{owner}/{repo}/pulls --jq '.[] | select(.draft == false) | "#\(.number) \(.title)"'

# Extract one nested field
gh api repos/{owner}/{repo} --jq '.default_branch'

# Count
gh api repos/{owner}/{repo}/issues --jq 'length'

# Object reshape
gh api repos/{owner}/{repo}/issues --jq '.[] | {n: .number, t: .title, l: [.labels[].name]}'
```

`--jq` accepts any jq expression. Reference: <https://jqlang.org/manual/>.

---

## Formatting with `--template` (Go templates)

For human-readable output without jq, use `--template`. Supports the standard Go template functions plus gh extensions: `pluck`, `join`, `color`, `truncate`, `autocolor`, `tablerow`, `tablerender`, `hyperlink`, `timeago`, `timefmt`.

```bash
# One title per line
gh api repos/{owner}/{repo}/issues \
  --template '{{range .}}{{.title}}{{"\n"}}{{end}}'

# Title + labels (yellow), one per line
gh api repos/{owner}/{repo}/issues \
  --template '{{range .}}{{.title}} ({{.labels | pluck "name" | join ", " | color "yellow"}}){{"\n"}}{{end}}'

# Tabular output
gh api repos/{owner}/{repo}/issues --template \
  '{{range .}}{{tablerow .number .title (.user.login | color "cyan")}}{{end}}{{tablerender}}'
```

---

## Pagination

### REST pagination (`--paginate`)

Works for endpoints whose response is a **top-level JSON array** AND respects standard REST pagination via the `Link` header.

```bash
# All issues across all pages
gh api --paginate repos/{owner}/{repo}/issues --jq '.[].number'

# Combine with -X GET for endpoints that take query params
gh api --paginate -X GET search/issues -f q='repo:cli/cli is:open' --jq '.items[].number'
```

For object-response endpoints (single resource, not a list), `--paginate` won't help — the endpoint doesn't paginate. For endpoints that return an *object containing* an array (like `search/issues` which returns `{total_count, items}`), use `--jq '.items[]'` to flatten, or `--slurp` to wrap each page as one entry.

### REST `--slurp`

Wraps multiple page-responses into one JSON array. Use when each page is an object (not an array), or when you want to preserve page boundaries.

```bash
gh api --paginate --slurp search/issues -f q='is:open' \
  --jq 'map(.items[]) | length'
```

### GraphQL pagination

GraphQL pagination requires your query to accept `$endCursor: String` and fetch `pageInfo { hasNextPage, endCursor }`. The CLI inspects these fields and replays the query with the new cursor until `hasNextPage == false`.

```bash
gh api graphql --paginate -f query='
  query($endCursor: String) {
    viewer {
      repositories(first: 100, after: $endCursor) {
        nodes { nameWithOwner }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
'
```

With `--slurp`, each page-response is preserved as a separate object in the output array — useful for counting pages or aggregating per-page metrics:

```bash
gh api graphql --paginate --slurp -f query='
  query($endCursor: String) {
    viewer {
      repositories(first: 100, after: $endCursor) {
        nodes { isFork }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
' | jq '[.[].data.viewer.repositories.nodes[]] as $r | ([$r[] | select(.isFork)] | length) / ($r | length)'
```

---

## GraphQL (`gh api graphql`)

```bash
gh api graphql -f query='query { viewer { login } }'
```

- Fields other than `query` and `operationName` become GraphQL variables.
- Use `-F` for typed variables, `-f` for string variables, same semantics as REST.

```bash
gh api graphql \
  -F owner='{owner}' \
  -F name='{repo}' \
  -F limit=3 \
  -f query='
    query($owner: String!, $name: String!, $limit: Int!) {
      repository(owner: $owner, name: $name) {
        releases(last: $limit) {
          nodes { tagName name createdAt }
        }
      }
    }
'
```

Mutations follow the same pattern:

```bash
gh api graphql \
  -F repoId="$(gh repo view --json id --jq .id)" \
  -F title='New issue from CLI' \
  -F body='Body text' \
  -f query='
    mutation($repoId: ID!, $title: String!, $body: String!) {
      createIssue(input: {repositoryId: $repoId, title: $title, body: $body}) {
        issue { number url }
      }
    }
'
```

---

## Examples (canonical list from the gh manual)

```bash
# List releases
gh api repos/{owner}/{repo}/releases

# Post issue comment
gh api repos/{owner}/{repo}/issues/123/comments -f body='Hi from CLI'

# Upload nested-param file content
gh api gists -F 'files[myfile.txt][content]=@myfile.txt'

# Query params on GET (endpoint after -X GET)
gh api -X GET search/issues -f q='repo:cli/cli is:open remote'

# JSON file as body
gh api repos/{owner}/{repo}/rulesets --input file.json

# Custom Accept header
gh api -H 'Accept: application/vnd.github.v3.raw+json' \
  repos/{owner}/{repo}/contents/README.md

# Opt into API previews
gh api --preview baptiste,nebula <endpoint>

# Filter with jq
gh api repos/{owner}/{repo}/issues --jq '.[].title'

# Format with template
gh api repos/{owner}/{repo}/issues --template \
  '{{range .}}{{.title}} ({{.labels | pluck "name" | join ", " | color "yellow"}}){{"\n"}}{{end}}'

# Patch with nested-array body
gh api -X PATCH /orgs/{org}/properties/schema \
  -F 'properties[][property_name]=environment' \
  -F 'properties[][default_value]=production' \
  -F 'properties[][allowed_values][]=staging' \
  -F 'properties[][allowed_values][]=production'

# GraphQL query with vars
gh api graphql -F owner='{owner}' -F name='{repo}' -f query='
  query($name: String!, $owner: String!) {
    repository(owner: $owner, name: $name) {
      releases(last: 3) { nodes { tagName } }
    }
  }
'

# GraphQL pagination
gh api graphql --paginate -f query='
  query($endCursor: String) {
    viewer {
      repositories(first: 100, after: $endCursor) {
        nodes { nameWithOwner }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
'
```

---

## Common recipes

### "Find branch protection rules on main"

```bash
gh api repos/{owner}/{repo}/branches/main/protection
gh api repos/{owner}/{repo}/branches/main/protection --jq '.required_status_checks.contexts'
```

### "List collaborators (no porcelain command)"

```bash
gh api repos/{owner}/{repo}/collaborators --paginate --jq '.[] | {login, permissions}'
```

### "Get raw file contents at a specific commit"

```bash
gh api -H 'Accept: application/vnd.github.v3.raw' \
  repos/{owner}/{repo}/contents/path/to/file?ref=<sha>
```

### "Rate limit status"

```bash
gh api rate_limit
gh api rate_limit --jq '.resources.core | "core: \(.remaining)/\(.limit) until \(.reset | strftime("%H:%M"))"'
gh api rate_limit --jq '.resources.graphql | "graphql: \(.remaining)/\(.limit) until \(.reset | strftime("%H:%M"))"'
```

### "Re-run a check by name"

```bash
gh api repos/{owner}/{repo}/check-runs/<check-run-id>/rerequest -X POST
```

### "Add a custom property value to a repo"

```bash
gh api -X PATCH /repos/{owner}/{repo}/properties/values \
  -F 'properties[][property_name]=environment' \
  -F 'properties[][value]=production'
```

### "Triage a GitHub Project v2 (only via GraphQL)"

```bash
# Get project node id
gh api graphql -f query='
  query { organization(login: "my-org") { projectV2(number: 5) { id title } } }
'

# Add an existing issue to a project
gh api graphql \
  -F projectId='PVT_kwDOXXXXXX' \
  -F contentId="$(gh issue view 42 --json id --jq .id)" \
  -f query='
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item { id }
      }
    }
'
```

### "Org audit log (needs admin:org scope)"

```bash
gh api -X GET /orgs/{org}/audit-log -f phrase='action:repo.create created:>2026-01-01' --paginate
```

---

## Output behavior

- **Default:** prints response body to stdout.
- **`-i`:** prefixes with HTTP status + headers.
- **`--verbose`:** prints full request + response (good for debugging auth and headers).
- **`--silent`:** prints nothing. Useful when you only care about the exit code (success = `0`, HTTP 4xx/5xx = nonzero).
- **Exit code:** `0` on 2xx, nonzero on HTTP error. Network failure exits `1` with stderr message.

---

## Cache

`--cache <duration>` caches successful responses on disk; subsequent identical calls within the window skip the network. Useful for repeated reads of stable data inside scripts.

```bash
gh api repos/{owner}/{repo}/contents/README.md --cache 1h
```

Cache is keyed on URL + method + body. Clear with `gh config clear-cache` (clears all gh response caches, not just `--cache` ones).