# AGENTS.md

Custodian's agent instructions live in [`CLAUDE.md`](CLAUDE.md). Read that file — it is the whole
contract, and this file exists only so a harness that looks for `AGENTS.md` finds its way there.

The parts most often skipped, in the order they get skipped:

1. **Parallelise.** Independent tool calls go in one block. `CLAUDE.md` § *Parallelise*.
2. **The mandatory-skills table.** Every row is a MUST, not a suggestion.
3. **The review pipeline**, in order, before merge — including `compliance-reviewer` for any change
   touching personal data, memory, retrieval, caching or logging.
4. **`.claude/rules/locked-decisions.md`** — architectural decisions already stress-tested. It is
   machine-local and absent from a fresh clone; the reasoning is in the commit messages.
