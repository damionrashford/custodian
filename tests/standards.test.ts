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
