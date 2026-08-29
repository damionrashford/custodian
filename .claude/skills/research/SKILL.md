---
name: research
description: Manage the .research/ platform specification corpus — convert new .docx drops to verified .txt, and search the corpus for what it says about a topic with file:line citations. Use when new .docx files appear in .research/, when asked to convert or ingest research documents, before implementing any platform component, or when asked what the spec/research says about something.
allowed-tools: Bash(textutil *), Bash(ls *), Bash(wc *), Bash(rm *), Bash(head *), Bash(grep *), Bash(rg *)
argument-hint: [ingest | topic]
---

## Current .research/ contents

!`ls -la .research/ 2>/dev/null || echo "no .research directory"`

## Dispatch

- `$ARGUMENTS` is empty or `ingest` → run **Ingest**.
- Otherwise → run **Lookup** with `$ARGUMENTS` as the topic.

## Ingest

For every `.docx` file in `.research/` that does not already have a matching `.txt` sibling:

1. Convert with `textutil -convert txt "<file>.docx" -output "<file>.txt"`.
2. Verify the output is non-empty and contains recognizable prose — check `wc -l` is well above zero and the first ~200 characters read as real text, not garbage. A failed or corrupt conversion produces an empty or near-empty file.
3. Only after every conversion verifies clean, remove the original `.docx` files.

Do not remove a `.docx` before its `.txt` counterpart has been verified. Report which files were converted and their line counts.

## Lookup

Search `.research/*.txt` for everything relevant to the topic.

Use `rg -n -i` (fall back to `grep -n -i` if `rg` is unavailable) against `.research/*.txt`. Check both the current documents and, if the topic concerns something later revised, whether a `_v2` file supersedes a `_v1` file — prefer the v2 position and note when it changed and why.

Answer with the resolved position first, then cite each supporting passage as `file.txt:line`. If the corpus doesn't resolve the question, say so plainly rather than inferring — `Gap_Register_v2.txt` lists what's still open.
