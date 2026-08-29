# Writing and classifying entries

## Picking the change type

Ask what the reader's *upgrade experience* is, not what the diff touched.

| Reader's experience | Type |
|---|---|
| Something exists now that did not exist before | `Added` |
| Something that already existed behaves differently | `Changed` |
| Something still works but will be taken away | `Deprecated` |
| Something that used to exist is gone | `Removed` |
| Something that was supposed to work now does | `Fixed` |
| A vulnerability was closed, mitigated, or disclosed | `Security` |

Tie-breaks:

- **New option on an existing feature** → `Added` (the option is new).
- **Default value changed** → `Changed`, and say the old and new default.
- **Bug fix that changes documented behaviour people relied on** → `Changed`, not `Fixed`.
- **Performance improvement** → `Changed` ("Reduced context assembly latency from 900ms to 210ms"). There is no Performance type.
- **Dependency bump with no user-visible effect** → not notable, omit. With a user-visible effect → the type that matches the effect.
- **Security fix** → `Security`, always. Never `Fixed`. A reader scanning for whether they must upgrade urgently looks at `Security` and nowhere else.
- **Breaking change** → whichever type fits (`Changed` or `Removed`), but the entry text must say it breaks and what to do instead.

## Deprecation lifecycle — the spec's one hard demand

A feature must appear in `Deprecated` in a release *before* it appears in `Removed` in a later release. A `Removed` entry with no earlier `Deprecated` entry is an upgrade trap: users cannot step through it. If a removal genuinely had no deprecation window, say so explicitly in the entry.

## Entry text

One line, one user-visible change, present tense describing the shipped state or past tense describing the action. Start with the thing that changed, not with "Update" or "Improve".

| Bad | Why | Good |
|---|---|---|
| `4f9ac21 patch the thing` | commit sha dump | `Fixed retry loop no longer double-charges the tenant on a 429.` |
| `feat: add streaming` | Conventional Commit subject | `Added token-by-token streaming for chat completions.` |
| `Merge pull request #482 from acme/fix-auth` | merge commit | `Fixed expired session tokens being accepted for up to 60 seconds.` |
| `Various fixes and improvements` | says nothing | one entry per actual change |
| `Refactored ContextAssembler to use a strategy table` | describes the system to itself | omit — not user-visible — or state the effect |
| `Bumped @scope/sdk to 4.2.1` | not notable on its own | `Added support for the 2026-06 model snapshots.` |

Include the migration in the entry when one is needed:

```
- **Breaking** Removed the `POST /v1/run` endpoint. Use `POST /v2/runs`; see the migration guide.
- Deprecated `RouterConfig.fallbackModel`. Use `RouterConfig.fallbackChain`; the old field is honoured until 2.0.0.
```

## Semantic Versioning linkage

Declare the linkage in the intro, then keep it true. Which type appears drives the bump:

| Entries present | Bump |
|---|---|
| Any `Removed`, or a `Changed` that breaks a documented contract | MAJOR |
| Any `Added`, or a `Deprecated`, or a backward-compatible `Changed` | MINOR |
| Only `Fixed` (and `Security` fixes that break nothing) | PATCH |

A `Security` entry does not force a MAJOR bump — but if the fix breaks a contract, the breakage does.

## Scope: what is "notable"

Notable = a reader of this project's public surface would change what they do because of it. Not notable = whitespace, internal refactors with identical behaviour, test-only changes, CI config, lint fixes.

The inconsistency trap: partial coverage is as dangerous as no changelog, because users treat the file as the single source of truth. If a change is skipped, it must be skipped because it is genuinely not notable — never because nobody got round to it.

## Where entries go while unreleased

Every notable change lands in `## [Unreleased]` under its type, in the same change that ships the code. Do not batch changelog writing until release day — that is where commit-log dumping comes from.
