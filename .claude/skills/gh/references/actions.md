# GitHub Actions — `gh workflow` + `gh run`

Load when: working with GitHub Actions — listing or triggering workflows, watching runs, downloading artifacts, re-running failed jobs, viewing logs.

---

## `gh workflow` — workflow definitions

```bash
gh workflow list                              # all workflows in current repo (default 50)
gh workflow list --all                        # include disabled workflows
gh workflow list --limit 100
gh workflow list --json id,name,state,path --jq '.[]'

gh workflow view ci.yml                       # show one workflow (status, recent runs)
gh workflow view ci.yml --web                 # open in browser
gh workflow view ci.yml --yaml                # print the workflow source
gh workflow view 12345                        # by numeric ID instead of filename
gh workflow view ci.yml --ref develop         # view as of a branch/ref

gh workflow enable ci.yml                     # enable a disabled workflow
gh workflow disable ci.yml                    # disable (stops auto-triggers)
```

### Trigger `workflow_dispatch`

```bash
gh workflow run ci.yml                                # trigger on default branch
gh workflow run ci.yml --ref develop                  # on a specific branch
gh workflow run ci.yml -f input1=value -f input2=42   # workflow inputs
gh workflow run ci.yml -F input=@inputs.json          # input from file
echo '{"env":"prod"}' | gh workflow run deploy.yml --json
```

**Workflow must declare `on: workflow_dispatch` to be triggerable this way.**

After triggering, the run does NOT appear in `gh run list` immediately — there's a small queueing delay. Poll:

```bash
gh workflow run ci.yml
sleep 3
gh run list --workflow ci.yml --limit 1 --json databaseId,status --jq '.[0]'
```

---

## `gh run` — workflow runs

### List runs

```bash
gh run list                                   # last 20 runs (default)
gh run list --limit 100
gh run list --workflow ci.yml                 # one workflow
gh run list --branch main                     # one branch
gh run list --status failure                  # filter by status: queued|in_progress|completed|failure|success|cancelled|skipped|stale|action_required|neutral|timed_out
gh run list --user '@me'                      # runs triggered by you
gh run list --event push                      # filter by event: push|pull_request|workflow_dispatch|schedule|release|etc.

gh run list --json databaseId,name,status,conclusion,headBranch,event,createdAt \
  --jq '.[] | "\(.databaseId) \(.conclusion // .status) \(.headBranch) — \(.name)"'

# Failing runs on main this week:
gh run list --branch main --status failure --limit 50 \
  --json databaseId,name,createdAt --jq '.[] | select(.createdAt > "2026-05-09")'
```

### View one run

```bash
gh run view <run-id>                          # status + jobs + steps
gh run view <run-id> --web                    # open in browser
gh run view <run-id> --json conclusion,jobs --jq '.jobs[].name'

# Logs (the most useful flag):
gh run view <run-id> --log                    # full logs (LARGE)
gh run view <run-id> --log-failed             # only failed steps — usually what you want
gh run view <run-id> --job <job-id>           # focus on one job
gh run view <run-id> --job <job-id> --log     # logs of one job only

# Discover job IDs:
gh run view <run-id> --json jobs --jq '.jobs[] | {id: .databaseId, name, conclusion}'
```

### Watch a run (block until finish)

```bash
gh run watch                                  # interactive picker
gh run watch <run-id>                         # block until finished
gh run watch <run-id> --exit-status           # also exit non-zero if run failed
gh run watch <run-id> --interval 5            # poll every 5 s (default 3)

# CI-gate pattern: trigger + wait + die on failure
gh workflow run ci.yml --ref "$BRANCH" \
  && sleep 3 \
  && gh run watch $(gh run list --workflow ci.yml --branch "$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId') \
     --exit-status
```

### Cancel / re-run / delete

```bash
gh run cancel <run-id>

gh run rerun <run-id>                         # re-run entire run with same inputs
gh run rerun <run-id> --failed                # only re-run failed jobs (faster, cheaper)
gh run rerun <run-id> --job <job-id>          # re-run one specific job
gh run rerun <run-id> --debug                 # enable step debug logging on the re-run

gh run delete <run-id>                        # DESTRUCTIVE — removes history + artifacts
```

### Download artifacts

```bash
gh run download <run-id>                              # all artifacts to cwd
gh run download <run-id> --dir ./out                  # to a specific directory
gh run download <run-id> --name <artifact-name>       # one named artifact
gh run download <run-id> --pattern '*.log'            # by glob

# Without a run-id: download from the most recent run on current branch
gh run download

# Download latest artifact across all runs (useful for "latest test report"):
latest=$(gh run list --workflow ci.yml --status success --limit 1 --json databaseId --jq '.[0].databaseId')
gh run download "$latest" --name test-report --dir ./reports
```

---

## Common patterns

### "Did the latest CI pass on my branch?"

```bash
branch=$(git branch --show-current)
gh run list --branch "$branch" --limit 1 \
  --json conclusion,databaseId,htmlUrl \
  --jq '.[0] | "\(.conclusion // "in_progress") — \(.htmlUrl)"'
```

### "Tail the logs of the in-progress run"

```bash
# gh doesn't natively tail; closest equivalent:
gh run watch <run-id>            # shows step-by-step progress
# For raw streaming, use the API:
gh api repos/{owner}/{repo}/actions/runs/<run-id>/logs > logs.zip
unzip logs.zip -d logs/
```

### "Re-run just the failed jobs of the latest PR check run"

```bash
pr=$(gh pr view --json number --jq .number)
run=$(gh run list --json databaseId,event,pullRequests \
        --jq ".[] | select(.event == \"pull_request\" and any(.pullRequests[]?; .number == $pr)) | .databaseId" \
        | head -1)
gh run rerun "$run" --failed
```

### "Get the failure logs for the latest run on main"

```bash
run=$(gh run list --workflow ci.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$run" --log-failed
```

### "Wait for current branch's CI to finish, then merge PR"

```bash
pr=$(gh pr view --json number --jq .number)
gh pr checks "$pr" --watch --fail-fast \
  && gh pr merge "$pr" --squash --delete-branch
```

### "List artifacts produced by a run"

```bash
gh api repos/{owner}/{repo}/actions/runs/<run-id>/artifacts \
  --jq '.artifacts[] | {id, name, size_in_bytes, expired, archive_download_url}'
```

### "Find which commit introduced a CI failure"

```bash
# bisect-style scan of the last N runs
gh run list --workflow ci.yml --branch main --limit 50 \
  --json headSha,conclusion,createdAt \
  --jq '.[] | "\(.headSha[:7]) \(.conclusion) \(.createdAt)"'
```

### "Trigger a workflow with multi-line input"

```bash
jq -n --arg notes "$(cat release-notes.md)" '{notes: $notes}' \
  | gh workflow run release.yml -F notes=@-
```

---

## Status, conclusion, event values (canonical)

These are the values that appear in `--json status` / `--json conclusion` / `--json event` — useful for `--jq 'select(...)'` filters.

| Field | Possible values |
|---|---|
| `status` | `queued`, `in_progress`, `waiting`, `pending`, `requested`, `completed` |
| `conclusion` (only set when `status == completed`) | `success`, `failure`, `cancelled`, `skipped`, `timed_out`, `action_required`, `neutral`, `stale` |
| `event` | `push`, `pull_request`, `pull_request_target`, `workflow_dispatch`, `schedule`, `release`, `issues`, `issue_comment`, `repository_dispatch`, `check_run`, `check_suite`, `deployment`, `workflow_run`, `merge_group`, plus repo-defined events |

---

## When to use `gh api` instead

`gh api` exposes Actions API endpoints with no porcelain equivalent:

- Workflow-level secrets / variables (`gh secret`/`variable` cover repo + env + org but some org-level Actions endpoints are API-only).
- Runner management: `gh api repos/{owner}/{repo}/actions/runners` (list/register/delete self-hosted runners).
- Cache management beyond `gh cache list/delete`.
- Job-step log access at the byte level: `gh api repos/{owner}/{repo}/actions/jobs/{job_id}/logs`.
- Workflow run usage / billing: `gh api repos/{owner}/{repo}/actions/runs/{run_id}/timing`.

Load `references/api.md` for those.
