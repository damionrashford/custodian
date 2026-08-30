module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "Engineering_Standards.txt:230 — cycles at any depth fail the build.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-is-pure",
      comment:
        "domain imports no framework, no SDK and no runtime built-in. The ONLY cross-package " +
        "barrel a domain file may reach is domain-primitives. The previous rule exempted every " +
        "package barrel, which waved through a domain file importing an adapter from any barrel " +
        "that mixes layers (crypto-shred, execution-log, gateway and four others export " +
        "infrastructure alongside domain). Every type two domains both need lives in " +
        "domain-primitives, which keeps this rule self-maintaining rather than a list to update.",
      severity: "error",
      from: { path: "^packages/[^/]+/src/domain/", pathNot: "\\.test\\.ts$" },
      to: {
        dependencyTypes: ["core", "npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled"],
        pathNot: "^packages/(domain-primitives/src/index\\.ts$|[^/]+/src/domain/)",
      },
    },
    {
      name: "domain-crosses-only-through-domain-primitives",
      comment:
        "A domain file may reach exactly one other package barrel: domain-primitives. Seven " +
        "barrels export infrastructure or application code alongside domain (crypto-shred, " +
        "execution-log, gateway, idempotency, response-cache, streaming, tool-registry), so any " +
        "other barrel is a route from domain to an adapter. This rule is keyed on paths alone " +
        "because dependencyTypes never matches a workspace import — which is why domain-is-pure " +
        "silently passed these for the whole build.",
      severity: "error",
      from: { path: "^packages/[^/]+/src/domain/", pathNot: "\\.test\\.ts$" },
      // Matched against the bare specifier, not a resolved path: Bun's isolated linker leaves
      // workspace packages unresolvable to dependency-cruiser (couldNotResolve=true,
      // dependencyTypes=unknown), so every path-based or dependencyTypes-based rule silently
      // passes every cross-package import. Keying on the specifier is what actually fires.
      to: {
        path: "^@custodian/",
        // The pure-vocabulary packages: barrels that export domain only. scripts/check-structure.ts
        // fails the build if either ever exports from infrastructure/ or application/, so this list
        // cannot silently rot into the hole it was written to close.
        pathNot: "^@custodian/(domain-primitives|retention)$",
      },
    },
    {
      name: "domain-imports-domain-only",
      severity: "error",
      from: { path: "^packages/[^/]+/src/domain/", pathNot: "\\.test\\.ts$" },
      to: { path: "^packages/[^/]+/src/(application|infrastructure|interface)/" },
    },
    {
      name: "application-imports-domain-only",
      severity: "error",
      from: { path: "^packages/[^/]+/src/application/", pathNot: "\\.test\\.ts$" },
      to: { path: "^packages/[^/]+/src/(infrastructure|interface)/" },
    },
    {
      name: "infrastructure-may-not-import-interface",
      severity: "error",
      from: { path: "^packages/[^/]+/src/infrastructure/", pathNot: "\\.test\\.ts$" },
      to: { path: "^packages/[^/]+/src/interface/" },
    },
    {
      name: "interface-may-not-import-infrastructure",
      comment:
        "Only the composition root (src/main.ts) wires adapters — program plan §Composition roots.",
      severity: "error",
      from: { path: "^packages/[^/]+/src/interface/", pathNot: "\\.test\\.ts$" },
      to: { path: "^packages/[^/]+/src/infrastructure/" },
    },
    {
      name: "no-barrel-inside-package",
      comment: "One barrel per package root; internal code imports by direct path.",
      severity: "error",
      from: { path: "^packages/[^/]+/src/.+/" },
      to: { path: "^packages/[^/]+/src/index\\.ts$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    // Without this, dependency-cruiser cruises transpiled output, where `import type` has already
    // been erased — and under `verbatimModuleSyntax` most cross-package imports in `domain` are
    // type-only. The layering rules below would then pass a domain file importing an infrastructure
    // package's types, which is the exact violation they exist to catch.
    tsPreCompilationDeps: true,
    // Bun's isolated linker symlinks workspace deps into node_modules. Resolving to the realpath
    // keeps cross-package imports on their true `packages/...` paths, which is what the `from`
    // and `to` patterns above match against.
    preserveSymlinks: false,
  },
};
