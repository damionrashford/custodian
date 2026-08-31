---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
  - "scripts/**/*.ts"
  - "package.json"
---

# Change Discipline

Applies to all first-party platform source. Companion to `.claude/rules/architecture.md` —
that file defines what good code looks like at rest; this one defines what a complete *change* looks
like. The repo has one implementation of anything at any moment. There is no old path, no new path
behind a flag, no shim between them.

## A change is complete only when its whole blast radius moved with it

Changing a signature, a type, a field name, a file location, or a behaviour means changing **every
upstream caller and every downstream consumer in the same change**. Not a follow-up PR, not a tracked
issue, not a TODO. If the blast radius is too large to land at once, the change is wrong-shaped —
split it by *capability*, so each piece is independently complete, never by *layer*, which always
leaves one side talking to a placeholder.

Concretely, the same change that alters a thing also:

- updates every call site (`rg` for the old symbol returns zero hits outside its own history),
- updates the port interface in `domain` **and** every adapter in `infrastructure` that implements it,
- updates the tests that covered the old shape — rewritten, not skipped, not `.todo`,
- deletes the replaced code, file, folder, export, dependency, and config key,
- updates the docs/rule files that describe the old behaviour.

## Banned: plugs

A plug is anything that lets an incomplete change look finished. All of these fail review, none have
a warning tier:

| Plug | Why it's banned |
|---|---|
| `throw new Error("not implemented")` reached by any real path | A runtime failure the type system was supposed to prevent |
| Stub returning a fake value to satisfy a caller | The caller is now verified against a lie |
| `TODO` / `FIXME` without a linked, open issue | Untracked debt; already banned in Comments |
| Commented-out old implementation | Version control is the archive |
| Feature flag selecting old-vs-new implementation | Two live code paths, and incident response has to guess which ran |
| Adapter translating new shape → old shape for unmigrated callers | The migration is now permanent |
| `v2`/`-new`/`-legacy` suffix on an internal module | Two implementations of one concept |
| Re-export alias keeping a renamed symbol alive | A rename that didn't rename anything |
| `@deprecated` on internal code | Internal code has no deprecation tier — delete it |
| Widening a type (`unknown`, optional field, union member) so old callers still compile | Postpones the error to runtime, in production |
| Disabling a lint rule or strict flag at the call site | Loosening the config is a rollback (Engineering Standards) |

**The one exception, already carved out:** published boundaries — the tenant-facing API, webhook
payloads, and durable workflow definitions — are versioned and retired on a schedule, because a
workflow started under one deployment may replay under another. Versioning there is required;
versioning anywhere else is a plug.

## Rename and move are full changes

A file moves → every import path updates in the same commit. A concept is renamed → folder, file,
type, function, variable, test file, token, and doc heading all rename together. Half-renamed code is
worse than the original name, because the reader now has to learn both.

## Dependencies

Adding one means it's used in the same change. Removing the last use means removing it from
`package.json` and the lockfile in the same change. `knip` failing on an unused dep is a blocking
gate, not a cleanup ticket.

## File size and folder conventions

Budgets, naming conventions, prohibited names (`utils`, `helpers`, `common`, `shared`, `misc`,
`manager`, `data`), and the barrel-file policy live in `.claude/rules/architecture.md` —
that table is authoritative, don't restate it elsewhere. Three additions specific to how changes
land:

- **Split by responsibility, never by line count.** A 340-line file doing one thing stays. A 180-line
  file doing two things splits. Hitting a budget is a signal to re-read the file, not a mandate to
  cut it in half at the nearest blank line.
- **Folder = one component, four layers inside it.** A platform component (Guardrails, Routing,
  Context Assembly, C18–C23) owns one kebab-case folder; its `domain`/`application`/`infrastructure`/
  `interface` subfolders are where the layering rule is actually visible. `scaffold-component` lays
  this out — use it rather than hand-rolling a variant.
- **A new folder needs a named concept.** If the best available name for it is one of the prohibited
  words, the code belongs in an existing component, not a new folder.

## Enforcement

| Check | Catches | Blocking |
|---|---|---|
| `tsc --noEmit` | Callers not updated to a new signature | Yes |
| `knip` | Orphaned files, unused exports, unused deps left behind by a partial change | Yes |
| `dependency-cruiser` | Shims that inverted a dependency arrow to stay compatible | Yes |
| ESLint (`ban-ts-comment`, `no-explicit-any`, `no-non-null-assertion`) | Suppressions used as plugs | Yes |
| `rg` for the removed symbol | Half-completed rename | Reviewer |
| Reviewer question | "What still refers to the thing this replaced?" | Reviewer |

Before claiming a change is done, run `superpowers:verification-before-completion`. "The diff is
written" and "every consumer of this compiles, passes, and no longer references the old path" are
different claims — only the second one is done.
