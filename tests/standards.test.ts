import { expect, test } from "bun:test";

/**
 * Engineering_Standards.txt:30-60 — "this is the floor, not a starting point for negotiation".
 * Loosening the config is a rollback of the standard, so it fails a test rather than passing
 * silently in a pull request nobody reads closely.
 */
const REQUIRED_COMPILER_OPTIONS: Readonly<Record<string, boolean | string>> = {
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noPropertyAccessFromIndexSignature: true,
  noImplicitReturns: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  allowUnreachableCode: false,
  allowUnusedLabels: false,
  verbatimModuleSyntax: true,
  isolatedModules: true,
  noUncheckedSideEffectImports: true,
  moduleDetection: "force",
  forceConsistentCasingInFileNames: true,
  erasableSyntaxOnly: true,
  declaration: true,
  declarationMap: true,
  sourceMap: true,
  skipLibCheck: true,
};

/** Parse boundary: JSON arrives as `unknown` and is narrowed once, here. */
function readProperty(source: object, name: string): unknown {
  const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(source, name);
  return descriptor === undefined ? undefined : descriptor.value;
}

function readCompilerOptions(parsed: unknown): object {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("tsconfig.base.json did not parse to an object");
  }
  const options = readProperty(parsed, "compilerOptions");
  if (typeof options !== "object" || options === null) {
    throw new Error("tsconfig.base.json has no compilerOptions object");
  }
  return options;
}

test("tsconfig.base.json declares every mandated compiler option", async () => {
  const parsed: unknown = await Bun.file(new URL("../tsconfig.base.json", import.meta.url)).json();
  const compilerOptions = readCompilerOptions(parsed);

  for (const [option, expected] of Object.entries(REQUIRED_COMPILER_OPTIONS)) {
    expect([option, readProperty(compilerOptions, option)]).toEqual([option, expected]);
  }
});

/**
 * Repo-configuration invariants. Each of these guards a failure that actually happened, and each
 * was invisible until something downstream broke — which is why they live in a test rather than in
 * a comment somebody has to remember to read.
 */

async function readRepoFile(relative: string): Promise<string> {
  return Bun.file(new URL(`../${relative}`, import.meta.url)).text();
}

test("CI runs on every pull request, not only those targeting main", async () => {
  const workflow = await readRepoFile(".github/workflows/ci.yml");
  const afterTrigger = workflow.slice(workflow.indexOf("pull_request:") + "pull_request:".length);
  const nextDirective = afterTrigger.split("\n").find((line) => line.trim().length > 0) ?? "";

  // Stage branches are stacked, so a PR often targets another stage. A branch filter here left
  // four stacked PRs with no checks at all — they looked mergeable while never having been run.
  expect(nextDirective).not.toContain("branches:");
});

test("no test reaches the network", async () => {
  const offenders: string[] = [];
  for await (const path of new Bun.Glob("tests/**/*.ts").scan(".")) {
    const source = await readRepoFile(path);
    if (/https?:\/\//.test(source)) {
      offenders.push(path);
    }
  }

  // A flaky network dependency inside a blocking gate is worse than no gate: a gate that never
  // fires is false assurance, but one that fires at random trains people to click through red CI,
  // which costs the credibility of every gate beside it.
  expect(offenders).toEqual([]);
});

test("the TypeScript pin is ignored under the ecosystem that owns it", async () => {
  const dependabot = await readRepoFile(".github/dependabot.yml");
  const blocks = dependabot.split("- package-ecosystem:");
  const bunBlock = blocks.find((block) => block.trimStart().startsWith('"bun"')) ?? "";

  // LD-5 pins TypeScript to 6.x. An ignore filed under the wrong ecosystem parses fine and does
  // nothing at all, which is how a considered decision gets quietly reversed by a bot.
  expect(bunBlock).toContain("typescript");
  expect(bunBlock).toContain("7.x");
});

test("the layering gate sees type-only imports", async () => {
  const config = await Bun.file(".dependency-cruiser.cjs").text();

  // Without this, dependency-cruiser cruises transpiled output where `import type` is already gone.
  // Under verbatimModuleSyntax most cross-package imports in `domain` are type-only, so the
  // layering rules passed clean for the whole build while never inspecting them. Three real
  // violations surfaced the moment it was turned on.
  expect(config).toContain("tsPreCompilationDeps: true");
});

/**
 * Every workspace import a package makes must be declared in that package's own `package.json`.
 *
 * Nothing else checks this, which was a surprise worth recording. `bunfig.toml` sets
 * `linker = "isolated"` specifically to prevent phantom dependencies, and it does scope
 * `packages/<name>/node_modules` correctly — `routing`'s holds only `domain-primitives`. But module
 * resolution walks *up*, and the root `node_modules` holds all 27 packages, because LD-3 requires
 * every one of them in the root `devDependencies` so `tests/` can import them. The upward walk
 * defeats the isolation.
 *
 * Demonstrated rather than assumed: `gateway/infrastructure` importing `@custodian/oversight`, a
 * package absent from gateway's manifest, passed tsc, dependency-cruiser, knip and ESLint together.
 * dependency-cruiser catches the `domain` case only because a *layering* rule happens to fire there;
 * between any other two layers it sees nothing, since a workspace import arrives with
 * `dependencyTypes: unknown` (the reason `.dependency-cruiser.cjs` uses path-based rules at all).
 *
 * This is LD-11's shape a third time: a gate believed to enforce something, never shown to reject
 * the idiomatic violation.
 */
test("every workspace import is declared by the package that makes it", async () => {
  const importPattern = /from\s+"(@custodian\/[a-z-]+)"/g;
  const undeclared: string[] = [];

  for await (const manifestPath of new Bun.Glob("packages/*/package.json").scan(".")) {
    const directory = manifestPath.slice(0, manifestPath.lastIndexOf("/"));
    const manifest: unknown = await Bun.file(manifestPath).json();
    const dependencies = readProperty(
      typeof manifest === "object" && manifest !== null ? manifest : {},
      "dependencies",
    );
    const declared = new Set(
      typeof dependencies === "object" && dependencies !== null ? Object.keys(dependencies) : [],
    );
    const own = readProperty(
      typeof manifest === "object" && manifest !== null ? manifest : {},
      "name",
    );

    for await (const source of new Bun.Glob(`${directory}/src/**/*.ts`).scan(".")) {
      const text = await readRepoFile(source);
      for (const [, imported] of text.matchAll(importPattern)) {
        if (imported !== undefined && imported !== own && !declared.has(imported)) {
          undeclared.push(`${source} → ${imported}`);
        }
      }
    }
  }

  expect(undeclared).toEqual([]);
});

test("no subject key store holds its own keys", async () => {
  const offenders: string[] = [];
  for await (const path of new Bun.Glob("packages/**/src/**/*.ts").scan(".")) {
    const source = await readRepoFile(path);
    if (/implements SubjectKeyStore/.test(source) && !/KeyCustodian/.test(source)) {
      offenders.push(path);
    }
  }

  // The deleted AesGcmSubjectKeyStore generated and held its own keys, so a restart was an Article
  // 17 erasure of every subject at once. Reintroducing that shape looks like a helpful test double
  // right up to the moment it is composed in main.ts, and nothing else would catch it.
  expect(offenders).toEqual([]);
});

test("the vector index stores sealed embeddings, never bare vectors", async () => {
  const source = await readRepoFile(
    "packages/knowledge-base/src/infrastructure/in-memory-vector-index.ts",
  );

  // Scoped to the stored type, not the whole file. `sealEmbedding` legitimately *takes* a bare
  // vector — it is the thing being sealed — so a file-wide match would fail on correct code, and a
  // gate that fires on the right file for the wrong reason teaches people to edit the gate.
  const declaration = source.slice(
    source.indexOf("export type IndexedDocument"),
    source.indexOf("};", source.indexOf("export type IndexedDocument")),
  );

  // The data map gives the vector index exactly one erasure mechanism: key destruction, because
  // "soft delete is insufficient" (Data_Protection_and_Retention.txt:49-50). A bare number[] here
  // is a fragment that survives erasure, which is precisely what the release gate exists to fail.
  expect(declaration).toContain("readonly embedding: SealedContent");
  expect(declaration).not.toMatch(/readonly embedding:\s*readonly number\[\]/);
});

test("type assertions are exempt in exactly the two pinned source files", async () => {
  const config = await Bun.file("eslint.config.js").text();
  const block = config.slice(config.indexOf("Two exceptions the standard names"));
  const exempt = [...block.slice(0, block.indexOf("],")).matchAll(/"(packages\/[^"]+)"/g)];

  // A path list of individual parsers used to hold this exemption, and six files silently lost it
  // by moving one folder deeper. Every brand is now built through `brand()`, so the list is one
  // entry — and growing it back is a decision someone has to make in this test first.
  expect(exempt.map((m) => m[1])).toEqual([
    "packages/domain-primitives/src/domain/language/brand.ts",
    // A single-purpose row parser whose one assertion is hash-verified before anything returns —
    // a parser exemption in the standard's own sense, made deliberately here (LD-11: growing this
    // list is a decision, not a drive-by), and scoped to the parser file so the sqlite adapter
    // itself stays under the assertion ban.
    "packages/execution-log/src/infrastructure/parse-stored-entry.ts",
  ]);
});
