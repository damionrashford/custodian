#!/usr/bin/env bash
# graphify's hook-guard hardcodes "graphify-out/graph.json" into its advice text, but this repo
# keeps its graph at .graphify/ (GRAPHIFY_OUT in .claude/settings.json). CLAUDE.md records that
# gating on graphify-out/ once made the skill unreachable for an entire build, so a hook telling
# every session and subagent to look there is the same failure wearing a different hat — two code
# reviewers in one session read the injected text, disbelieved it, and ignored the guard entirely.
#
# Wrapping rather than patching the installed package: an upgrade would silently revert a patch,
# and the guard's own decision logic is fine — only the path it names is wrong.
set -euo pipefail

# Resolved from PATH rather than pinned to one machine's install location, so this wrapper is
# trackable. A clone without graphify installed gets a clean skip instead of a broken hook.
if ! command -v graphify >/dev/null 2>&1; then
  exit 0
fi

export GRAPHIFY_OUT="${GRAPHIFY_OUT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.graphify}"

graphify hook-guard "$1" \
  | sed 's|graphify-out/graph\.json|.graphify/graph.json|g'
