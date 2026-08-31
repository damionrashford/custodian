---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
  - "scripts/**/*.ts"
---

# Architecture

How the source tree is shaped and where a thing belongs. The language-level rules — banned
constructs, type discipline, the compiler floor — are in `typescript.md`. What a complete *change*
looks like is in `change-discipline.md`.

A rule without an automated check is a suggestion, so each item below names its enforcement.

## Four layers, dependencies point inward only

| Layer | Contains | May import |
|---|---|---|
| `domain` | Entities, value objects, business rules, port interfaces. Zero I/O. | Nothing — no framework, no SDK, no runtime built-ins |
| `application` | Use cases, orchestration, transaction boundaries. | `domain` only |
| `infrastructure` | Adapters: provider SDKs, vector store, queue, billing, telemetry. | `domain`, `application` |
| `interface` | HTTP handlers, workers, CLI, webhook receivers. | `application`, `domain` — never `infrastructure` directly |

**The load-bearing consequence:** the domain layer must be testable with no network, clock, or
environment variables. If a domain test needs a mock HTTP client, the dependency arrow points the
wrong way.

Enforced by `dependency-cruiser` alone, and that is a locked decision — `eslint-plugin-boundaries`
silently passed a planted `domain → infrastructure` violation (LD-2). Every rule in
`.dependency-cruiser.cjs` has been verified to reject a planted violation of the *idiomatic* form,
which for this codebase means an `import type` (LD-11).

Every platform component defines a port in `domain` and an adapter in `infrastructure`. That is what
makes provider-swap and model-fallback tractable, and what makes the eval pipeline possible without
a live provider.

## Folders

A component owns one kebab-case folder with the four layers inside it. Use the
`scaffold-component` skill rather than hand-rolling a variant.

Cross-package imports resolve through `@custodian/*`, mapped in `tsconfig.json` onto
`src/*/index.ts`. Every such import must be reachable from the component's own barrel; a component
importing another component's internals is a layering violation wearing a different hat.

**Prohibited folder and file names:** `utils`, `helpers`, `common`, `shared`, `misc`, `manager`,
`data`. These are dumping grounds, not categories. If the best available name for a new folder is
one of these, the code belongs in an existing component.

## Naming

| Subject | Convention | Example |
|---|---|---|
| Folders | kebab-case, plural for collections | `context-assembly/`, `guardrails/` |
| Source files | kebab-case, named for the export | `token-meter.ts` |
| Test files | under `tests/`, mirrored by component | `tests/metering/token-meter.test.ts` |
| Types and classes | PascalCase, no `I` or `T` prefix | `TokenMeter` |
| Functions and variables | camelCase, verb-first for functions | `assembleContext()` |
| Constants | `SCREAMING_SNAKE_CASE`, module-scoped | `MAX_CONTEXT_TOKENS` |
| Booleans | `is` / `has` / `should` / `can` prefix | `isIdempotent` |
| Ports (interfaces) | Noun describing a capability | `VectorStore` |
| Adapters | `<Impl><PortName>` | `PineconeVectorStore` |

One exported concept per file; the filename matches the primary export.

## Barrels — restricted, not adopted

One barrel per published module boundary (a component root), zero barrels inside a component.
Barrels never re-export from another barrel, which is the direct cause of cycles. `export *` is
banned in a barrel — list explicit named exports, and use `export type` for type-only re-exports.
Internal code always imports by direct path, never through its own component's barrel.

## Size budgets

Review triggers, not hard limits. Exceeding one is a signal to re-read the file, never a mandate to
cut it at the nearest blank line: a 340-line file doing one thing stays, a 180-line file doing two
things splits.

| Unit | Budget | Hard stop | Signal when exceeded |
|---|---|---|---|
| Function | 40 lines | 80 | Doing more than one thing |
| File | 300 lines | 500 | More than one responsibility |
| Parameters | 3 | 5 | Wants a named options object |
| Cyclomatic complexity | 10 | 15 | Wants a strategy or lookup table |
| Nesting depth | 3 | 4 | Invert it, return early |
| Files per folder | 10 | 15 | Split the folder |
| Folder depth from `src/` | 4 | 5 | Structure mirrors an org chart, not the domain |
| Public exports per module | 7 | 12 | Surface too wide |

## Tests live under `tests/`, mirrored by component

`tests/<component>/<unit>.test.ts`, importing `@custodian/<component>` rather than reaching into
`src/`. This overrides the corpus, which specifies siblings (LD-3).

**The consequence worth knowing:** tests exercise the public barrel, so an internal helper that is
not exported cannot be unit-tested directly. That is a feature — it keeps the tested surface and the
supported surface identical — but it means a genuinely internal algorithm needs either an export
with a documented reason, or a test through its caller.

## PR gates

| Gate | Check | Blocking |
|---|---|---|
| Types | `tsc --noEmit`, zero errors | Yes |
| Lint | ESLint zero errors | Yes |
| Layering | `dependency-cruiser`: no inward violations, no cycles at any depth | Yes |
| Dead code | `knip`: no unused exports, files or dependencies | Yes |
| Format | Formatter check, never discussed in review | Yes |
| Tests | Domain layer covered, no network, no clock | Yes |
| Eval gate | Fast heuristic eval under 60s | Yes |
| Size budgets | Surfaced for reviewer judgement | No |
| Design review | Layer placement, naming, illegal states | Reviewer |

**The reviewer's four questions.** Is this in the right layer? Can an illegal state be constructed?
What happens on the second delivery of this request? If this is deleted in a year, what breaks?
