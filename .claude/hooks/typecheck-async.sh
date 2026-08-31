#!/usr/bin/env bash
# Typechecks in the background after a source edit and reports the result on the next turn.
#
# `bun run verify` is the gate, and it is slow enough that it gets run at the end of a batch of
# edits rather than after each one — which is correct, and means a type error introduced in the
# first edit is found after the twentieth. This closes that window without reintroducing the
# stop-and-wait cycle CLAUDE.md's parallelise rule exists to prevent: `async: true`, so nothing
# blocks, and the compiler's whole error list arrives at once rather than one error per turn.
#
# It reports failures only. A passing typecheck after every edit is noise, and noise in a
# reporting channel is how a real report gets skipped.
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')

case "$file" in
  *.ts) ;;
  *) exit 0 ;;
esac

[ -n "$cwd" ] && cd "$cwd" 2>/dev/null || exit 0
[ -f tsconfig.json ] || exit 0

if output=$(bun run typecheck 2>&1); then
  exit 0
fi

# Trimmed to the first errors: the point is to say "this is broken now", not to reproduce the
# compiler output, and hook context is capped at 10,000 characters anyway.
summary=$(printf '%s' "$output" | grep -E "error TS" | head -20)
[ -n "$summary" ] || exit 0

jq -n --arg s "$summary" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("The project does not typecheck after the last edit:\n" + $s)
  }
}'
