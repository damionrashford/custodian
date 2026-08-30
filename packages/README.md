# packages/

Bun workspace root (`workspaces: ["packages/*"]` in the root `package.json`). Empty for now —
Custodian is pre-implementation (see `CLAUDE.md`).

Each platform component (Phase 1–5 of the implementation plan, or the addendum's C18–C23) becomes
its own package here once scaffolded, e.g. `packages/execution-log/`, `packages/router/`. Use the
`scaffold-component` skill to lay out a new one's internal 4-layer structure
(`domain`/`application`/`infrastructure`/`interface`) per Engineering Standards — that's a different
concern from this directory, which just makes each component independently
installable/buildable/testable via Bun workspaces.

Root `package.json` intentionally carries no runtime `dependencies` — only root-level `devDependencies`
(type declarations for the test harness). Each package declares and installs its own dependencies;
cross-package references use `"workspace:*"`.

## Bun package-manager features to reach for once packages exist

Not set up yet — nothing below is active. Each is a lever, apply it when the situation it solves
for actually shows up, not before.

- **Isolated installs** (`bunfig.toml`: `install.linker = "isolated"`) — already configured at the
  repo root. Prevents phantom dependencies: a package importing something it never declared in its
  own `package.json`, which hoisted installs allow by accident. No action needed per-package.
- **Catalogs** (`workspaces.catalog` / `workspaces.catalogs.<name>` in root `package.json`) — once
  two or more packages need the same dependency pinned to the same version (e.g. a shared
  `typescript` or test-runner version), move it to a catalog instead of repeating the version string
  in every package. `bun add <pkg> --catalog` writes it. See
  [bun.com/docs/pm/catalogs](https://bun.com/docs/pm/catalogs).
- **`trustedDependencies`** — Bun refuses to run a dependency's `postinstall`/lifecycle scripts by
  default. If a package ever needs one (native bindings, codegen), add it explicitly:
  `bun pm trust <pkg>`, or set `trustedDependencies` in the affected package's own `package.json`.
  Defining the field **replaces** Bun's default allowlist rather than extending it — if you ever set
  it, re-list any default-trusted packages (e.g. `esbuild`, `sharp`) you still need.
- **Overrides/resolutions** (`package.json` `overrides` or `resolutions`) — pin a transitive
  dependency's version directly (e.g. a security patch upstream hasn't released yet), without
  waiting on the direct dependency to bump it.
- **Scopes/registries** (`bunfig.toml` `install.scopes`) — only relevant if a package ever needs a
  private/internal registry. Not applicable while everything comes from the public npm registry.
- **Security Scanner API** (`bunfig.toml` `install.security.scanner`) — plugs a third-party
  supply-chain scanner into `bun install` (scans before install, blocks on fatal advisories).
  Worth adopting once this repo has real dependencies beyond dev tooling, given the platform's own
  compliance posture — but needs a specific scanner package chosen first; don't wire in a placeholder.
