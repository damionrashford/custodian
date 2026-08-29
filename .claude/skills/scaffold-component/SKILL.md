---
name: scaffold-component
description: Scaffold a new platform component's 4-layer directory structure (domain/application/infrastructure/interface) per Engineering Standards naming and layering rules.
disable-model-invocation: true
argument-hint: [component-name]
---

Scaffold the component **$ARGUMENTS** (kebab-case; e.g. `token-meter`, `guardrails`, `router-training`).

Before creating anything:

1. Look up the component in `AI_Agent_Implementation_Plan_v2.txt` or `Agent_Architecture_Addendum.txt` (via the `spec-lookup` skill) to confirm its number, phase, and what it's responsible for.
2. Confirm the project has a `src/` root; if none exists yet, ask before creating one — this may be the first component.

Then create, under `src/$ARGUMENTS/`:

- `domain/` — entities, value objects, the port interface(s) this component exposes. Zero I/O, zero framework imports.
- `application/` — use cases orchestrating the domain, importing domain only.
- `infrastructure/` — adapter(s) implementing the domain ports, named `<Impl><PortName>` (e.g. `PineconeVectorStore`).
- `interface/` — the HTTP handler, worker, or CLI entry point, importing application and domain only, never infrastructure directly.

Follow `.claude/rules/engineering-standards.md` for file naming (kebab-case, one exported concept per file), size budgets, and the barrel-file policy (no barrel inside the module; a single barrel only at the package root if this component is published standalone).

Stub each layer with a minimal file plus a co-located `.test.ts` for the domain layer. Do not implement business logic — this is scaffolding only.
