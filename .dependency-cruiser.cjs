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
        "domain imports no framework, no SDK and no runtime built-in. First-party packages are " +
        "allowed through, because domain-primitives is itself pure domain.",
      severity: "error",
      from: { path: "^packages/[^/]+/src/domain/", pathNot: "\\.test\\.ts$" },
      to: {
        dependencyTypes: ["core", "npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled"],
        pathNot: "^packages/[^/]+/src/(domain/|index\\.ts$)",
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
    // Bun's isolated linker symlinks workspace deps into node_modules. Resolving to the realpath
    // keeps cross-package imports on their true `packages/...` paths, which is what the `from`
    // and `to` patterns above match against.
    preserveSymlinks: false,
  },
};
