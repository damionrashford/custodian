#!/usr/bin/env bash
# Runs the fast gates in the background after a source edit and reports only what broke.
#
# `bun run verify` is the gate, and it is slow enough that it runs at the end of a batch of edits
# rather than after each one — which is correct, and means a violation introduced in the first edit
# surfaces after the twentieth. This closes that window without reintroducing the stop-and-wait
# cycle CLAUDE.md's parallelise rule exists to prevent: `async: true`, so nothing blocks.
#
# Three gates, chosen because they are cheap and because each catches a shape the others cannot:
#
#   typecheck  0.74s  a signature change that did not reach its callers
#   layers     0.39s  an import pointing the wrong way through the four layers (LD-2 owns this)
#   deadcode   0.26s  the file, export or dependency a change was supposed to delete
#
# `lint` is deliberately absent at 2.55s — it is six times the cost of the other three combined and
# its findings are almost entirely warnings, which do not fail the build.
#
# This does NOT replace the gates in CI. A hook only fires when Claude edits a file in a session; it
# does nothing for a human contributor, another agent, or the required check on a pull request. It
# makes the same failures arrive sooner, which is the whole claim.
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

report=""
add() { report="${report}${report:+$'\n'}$1"; }

if ! out=$(bun run typecheck 2>&1); then
  add "typecheck:"$'\n'"$(printf '%s' "$out" | grep -E 'error TS' | head -15)"
fi
if ! out=$(bun run layers 2>&1); then
  add "layering:"$'\n'"$(printf '%s' "$out" | grep -E 'error|violation' | head -10)"
fi
if ! out=$(bun run deadcode 2>&1); then
  add "dead code:"$'\n'"$(printf '%s' "$out" | grep -vE '^\$|^$' | head -10)"
fi

[ -n "$report" ] || exit 0

jq -n --arg r "$report" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("A fast gate fails after the last edit:\n" + $r)
  }
}'
