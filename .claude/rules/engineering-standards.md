# Engineering Standards

Applies to all first-party platform source once implementation begins. A rule without an automated check is a suggestion — every item below has, or should have, a CI enforcement, noted inline. Full detail: `.research/Engineering_Standards.txt`.

## TypeScript configuration (the floor, not a starting point)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "forceConsistentCasingInFileNames": true,
    "erasableSyntaxOnly": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

Never disable an individual strict flag to unblock a build — fix the error. Loosening this config is a rollback and needs production-change review weight.

## Banned constructs (fail CI, no warning tier)

| Construct | Rule | Enforcement |
|---|---|---|
| `any` | Banned. Use `unknown` at boundaries, narrow. | `no-explicit-any: error` |
| `@ts-ignore` | Banned outright. | `ban-ts-comment` |
| `@ts-expect-error` | Only with description + linked issue. | `ban-ts-comment` w/ min description |
| Type assertions (`as`) | Banned except parsers/test fixtures. | `consistent-type-assertions: never` |
| Non-null (`!`) | Banned. Narrow or return early. | `no-non-null-assertion: error` |
| `enum` | Banned — use const unions. | `erasableSyntaxOnly` |
| Default exports | Banned outside framework entry points. | `no-default-export` |
| Implicit return types | Exported functions declare return types. | `explicit-module-boundary-types` |

## Type discipline

- **Parse, don't validate.** Untrusted input crosses the boundary once through a schema parser; everything downstream gets a fully-typed domain object.
- **Illegal states unrepresentable.** Discriminated unions, not optional-field bags — a compiler-rejected impossible combination beats a runtime check.
- **Branded primitives** at trust boundaries: `TenantId`, `RequestHash`, `PromptVersion` are branded, not bare strings — this is what makes the tenant-isolation guarantees hold.
- **Exhaustiveness checked**: every `switch` over a union ends in a `never` default.
- **Errors are typed and returned**, not thrown, across module boundaries. Throw only for programmer error / truly unrecoverable conditions.

## Layering (4 layers, dependencies point inward only)

| Layer | Contains | May import |
|---|---|---|
| `domain` | Entities, value objects, business rules, port interfaces. Zero I/O. | Nothing — no framework, no SDK, no runtime built-ins |
| `application` | Use cases, orchestration, transaction boundaries. | `domain` only |
| `infrastructure` | Adapters: provider SDKs, vector store, queue, billing, telemetry. | `domain`, `application` |
| `interface` | HTTP handlers, workers, CLI, webhook receivers. | `application`, `domain` — never `infrastructure` directly |

Load-bearing consequence: the domain layer must be testable with no network, clock, or env vars. If a domain test needs a mock HTTP client, the dependency arrow points the wrong way. Enforced by `eslint-plugin-boundaries` + `dependency-cruiser` (fails on any cycle at any depth).

Every platform component (Guardrails, Routing, Context Assembly, etc.) defines a port in `domain` and an adapter in `infrastructure` — this is what makes provider-swap and model-fallback tractable, and what makes the eval pipeline possible without a live provider.

## Naming

| Subject | Convention | Example |
|---|---|---|
| Folders | kebab-case, plural for collections | `context-assembly/`, `guardrails/` |
| Source files | kebab-case, named for the export | `token-meter.ts` |
| Test files | sibling, `.test.ts` suffix | `token-meter.test.ts` |
| Types/classes | PascalCase, no `I`/`T` prefix | `TokenMeter` |
| Functions/vars | camelCase, verb-first for functions | `assembleContext()` |
| Constants | `SCREAMING_SNAKE_CASE`, module-scoped | `MAX_CONTEXT_TOKENS` |
| Booleans | `is`/`has`/`should`/`can` prefix | `isIdempotent` |
| Ports (interfaces) | noun describing capability | `VectorStore` |
| Adapters | `<Impl><PortName>` | `PineconeVectorStore` |

Prohibited folder/file names: `utils`, `helpers`, `common`, `shared`, `misc`, `manager`, `data` — these are dumping grounds, not categories. One exported concept per file; filename matches the primary export.

## Size budgets (review triggers, not hard limits — tune once real code exists)

| Unit | Budget | Hard stop | Signal when exceeded |
|---|---|---|---|
| Function | 40 lines | 80 | Doing more than one thing |
| File | 300 lines | 500 | More than one responsibility |
| Parameters | 3 | 5 | Named options object |
| Cyclomatic complexity | 10 | 15 | Strategy/lookup table |
| Nesting depth | 3 | 4 | Invert, return early |
| Files per folder | 10 | 15 | Split the folder |
| Folder depth | 4 from `src/` | 5 | Structure mirrors org chart, not domain |
| Public exports/module | 7 | 12 | Surface too wide |

## Barrel files — restricted, not adopted

One barrel per **published module boundary** (a package root), zero barrels inside a module. Barrels never re-export from another barrel (the direct cause of cycles). `export *` is banned in a barrel — list explicit named exports. Type-only re-exports use `export type`. Internal code always imports by direct path, never through its own module's barrel.

## Comments

Permitted: why-comments (non-obvious decision, rejected alternative), invariant statements the type system can't encode, reference links (spec/RFC/incident), TSDoc on public API, safety annotations (why a pin/ordering exists). Banned: narration, commented-out code, changelog comments, section banners, untracked TODOs, apologies. Test: if deleting the comment loses no information recoverable from the code, delete it.

## Dead code and compatibility

Internal code: no deprecation tier — one way to do anything, old path deleted in the same change that replaces it. No commented-out code, no compat shims, no `v2` suffixes internally (`knip`/`ts-prune` fail CI on unused exports). **Exception: published boundaries** — webhook payloads, the tenant-facing API, and durable workflow state that outlives deployments need versioned contracts (version the payload/route/definition, retire on a published schedule), because a long-running workflow may replay under code deployed after it started.

## PR gates

| Gate | Check | Blocking |
|---|---|---|
| Types | `tsc --noEmit`, zero errors | Yes |
| Lint | ESLint zero errors | Yes |
| Layering | `dependency-cruiser`: no inward violations, no cycles | Yes |
| Dead code | `knip`: no unused exports/files/deps | Yes |
| Format | formatter check, never discussed in review | Yes |
| Tests | domain layer covered, no network/clock | Yes |
| Eval gate | fast heuristic eval <60s | Yes |
| Size budgets | surfaced for reviewer judgement | No |
| Design review | layer placement, naming, illegal states | Reviewer |

Reviewer's four questions: is this in the right layer? Can an illegal state be constructed? What happens on the second delivery of this request? If this is deleted in a year, what breaks?
