#!/usr/bin/env bash
# Refuses a path-restoring git command while the working tree is dirty.
#
# LD-12 exists because this went wrong twice with someone watching. A plant pass restores the
# planted file with `git checkout <file>`, which reverts it to HEAD — taking any *other* uncommitted
# work in that file with it. Nothing fails: reverting to a green HEAD leaves a green tree, so the
# tests pass, the diff looks clean, and the work is simply gone. It was found once only because a
# later manual check ran the server and saw it boot when it should have refused.
#
# `scripts/plant-guard.ts` already refuses a dirty tree, and LD-12 records that a reminder cannot
# work here, because the person holding the reminder is the one who just reverted the file. This is
# the mechanical half: the command itself is refused.
#
# Branch switches are deliberately not blocked. `git checkout main` and `git checkout -b x` do not
# discard uncommitted work — git refuses them itself when they would.
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -n "$command" ] || exit 0
[ -n "$cwd" ] && cd "$cwd" 2>/dev/null || true

# The path-restoring forms only. `git checkout -- x`, `git checkout .`, and any `git restore`
# without --staged rewrite the working tree from a commit.
if ! printf '%s' "$command" | grep -qE '(^|[;&|] *)git +(checkout +(--|\.)|restore )'; then
  exit 0
fi
if printf '%s' "$command" | grep -qE 'git +restore +--staged'; then
  exit 0
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
dirty=$(git status --porcelain 2>/dev/null | grep -v '^??' || true)
[ -n "$dirty" ] || exit 0

jq -n --arg files "$(printf '%s' "$dirty" | head -20)" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: (
      "Refused: this restores files from HEAD while the tree has uncommitted changes, which "
      + "discards them silently and leaves the tree green (LD-12). Commit or stash first — "
      + "`bun scripts/plant-guard.ts` enforces the same rule for plant passes.\nTracked changes:\n"
      + $files
    )
  }
}'
