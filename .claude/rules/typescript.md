---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "tsconfig.json"
  - "eslint.config.js"
---

# TypeScript

The language-level floor. Where code *belongs* is in `architecture.md`; what a complete change looks
like is in `change-discipline.md`.

## The compiler configuration is a floor, not a starting point

Every option below is set in `tsconfig.json`, and `tests/standards.test.ts` transcribes the list and
fails if any of it goes missing:

`strict` · `noUncheckedIndexedAccess` · `exactOptionalPropertyTypes` ·
`noPropertyAccessFromIndexSignature` · `noImplicitReturns` · `noImplicitOverride` ·
`noFallthroughCasesInSwitch` · `noUnusedLocals` · `noUnusedParameters` · `allowUnreachableCode:
false` · `allowUnusedLabels: false` · `verbatimModuleSyntax` · `isolatedModules` ·
`noUncheckedSideEffectImports` · `moduleDetection: force` · `forceConsistentCasingInFileNames` ·
`erasableSyntaxOnly` · `declaration` · `declarationMap` · `sourceMap` · `skipLibCheck`

**Never disable one to unblock a build — fix the error.** Loosening this configuration is a
rollback, and carries production-change review weight.

TypeScript is pinned to 6.0.3 rather than 7.x, because 7's compiler *API* is not ready and
`typescript-eslint` consumes it — migrating now would trade mechanical enforcement of the table
below for compile speed (LD-5). Re-check at the start of each stage; the pin is a cost, not a
preference.

## Banned constructs — CI failures, no warning tier

| Construct | Rule | Enforcement |
|---|---|---|
| `any` | Banned. Use `unknown` at the boundary and narrow. | `no-explicit-any: error` |
| `@ts-ignore` | Banned outright. | `ban-ts-comment` |
| `@ts-expect-error` | Only with a description and a linked issue. | `ban-ts-comment` with minimum description |
| Type assertions (`as`) | Banned except in parsers and test fixtures. | `consistent-type-assertions: never` |
| Non-null assertion (`!`) | Banned. Narrow, or return early. | `no-non-null-assertion: error` |
| `enum` | Banned — use a const union. | `erasableSyntaxOnly` |
| Default exports | Banned outside framework entry points. | `no-default-export` |
| Implicit return types | Exported functions declare their return type. | `explicit-module-boundary-types` |

Every brand is built through the single `brand()` constructor, which is what collapsed the
assertion exemption from a sixteen-path allowlist to one file. A path allowlist stopped exempting
six files the instant they moved a folder deeper (LD-11).

## Type discipline

- **Parse, don't validate.** Untrusted input crosses the boundary once, through a schema parser.
  Everything downstream receives a fully-typed domain object.
- **Make illegal states unrepresentable.** Discriminated unions, not optional-field bags — a
  combination the compiler rejects beats a runtime check that has to be remembered.
- **Brand primitives at trust boundaries.** `TenantId`, `RequestHash`, `PromptVersion` are branded,
  never bare strings. This is what makes the tenant-isolation guarantees hold rather than merely
  being described.
- **Check exhaustiveness.** Every `switch` over a union ends in a `never` default.
- **Return errors, don't throw them,** across module boundaries. Throw only for programmer error or
  a genuinely unrecoverable condition.

## Comments

**Permitted:** why-comments recording a non-obvious decision or a rejected alternative; invariant
statements the type system cannot encode; reference links to a spec, RFC or incident; TSDoc on
public API; safety annotations explaining why a pin or an ordering exists.

**Banned:** narration, commented-out code, changelog comments, section banners, untracked TODOs,
apologies.

**The test:** if deleting the comment loses no information recoverable from the code, delete it.
