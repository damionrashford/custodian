module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "engineering-standards.txt:230 — cycles at any depth fail the build.",
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
      from: { path: "^src/[^/]+/domain/", pathNot: "\\.test\\.ts$" },
      to: {
        dependencyTypes: ["core", "npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled"],
        pathNot: "^src/(primitives/index\\.ts$|[^/]+/domain/)",
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
      from: { path: "^src/[^/]+/domain/", pathNot: "\\.test\\.ts$" },
      // Keyed on the resolved path. When each component was a workspace package this had to match
      // the bare specifier, because Bun's isolated linker left workspace imports unresolvable to
      // dependency-cruiser (couldNotResolve, dependencyTypes=unknown) and every path-based rule
      // silently passed them. Under tsconfig `paths` they resolve to real files, so the ordinary
      // form works and the special case is gone.
      to: {
        path: "^src/[^/]+/index\\.ts$",
        // The pure-vocabulary component: the one barrel exporting domain only. scripts/check-structure.ts
        // fails the build if either ever exports from infrastructure/ or application/, so this list
        // cannot silently rot into the hole it was written to close.
        pathNot: "^src/primitives/index\\.ts$",
      },
    },
    {
      name: "domain-imports-domain-only",
      severity: "error",
      from: { path: "^src/[^/]+/domain/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/[^/]+/(application|infrastructure|interface)/" },
    },
    {
      name: "application-imports-domain-only",
      severity: "error",
      from: { path: "^src/[^/]+/application/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/[^/]+/(infrastructure|interface)/" },
    },
    {
      name: "infrastructure-may-not-import-interface",
      severity: "error",
      from: { path: "^src/[^/]+/infrastructure/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/[^/]+/interface/" },
    },
    {
      name: "interface-may-not-import-infrastructure",
      comment:
        "Only the composition root (src/main.ts) wires adapters — program plan §Composition roots.",
      severity: "error",
      from: { path: "^src/[^/]+/interface/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/[^/]+/infrastructure/" },
    },
    {
      name: "no-barrel-inside-component",
      comment:
        "One barrel per component, and its own code never routes through it — internal imports go " +
        "by direct path. The back-reference is what makes this correct: `$1` pins the `to` barrel " +
        "to the SAME component the importer lives in, so importing another component's barrel " +
        "stays legal, because that barrel is exactly the public surface a component is meant to " +
        "offer. Before the packages were collapsed this rule could not tell the two apart, and " +
        "never had to: cross-package imports were unresolvable to dependency-cruiser, so it only " +
        "ever saw the intra-package case. Once they resolved, it flagged 113 legitimate imports.",
      severity: "error",
      from: { path: "^src/([^/]+)/.+/" },
      to: { path: "^src/$1/index\\.ts$" },
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
    // Components resolve through tsconfig `paths` to real files under src/, so the patterns above
    // match resolved paths directly. No symlink indirection remains to unwind.
    preserveSymlinks: false,
  },
};
