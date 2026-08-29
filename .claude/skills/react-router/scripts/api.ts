#!/usr/bin/env bun
/**
 * api.ts — look up any exported React Router symbol in the generated TypeDoc
 * index: kind, owning package, and the canonical reference URL.
 *
 * Covers the full export surface (~900 symbols) including types, interfaces,
 * properties and UNSAFE_/unstable_ exports that the prose docs never mention.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/api.ts NAME [OPTIONS]
 *   bun ${CLAUDE_SKILL_DIR}/scripts/api.ts --package react-router --kind Function
 *
 * Exit codes: 0 ok · 1 cache missing or no matches · 2 invalid args
 */

const CACHE_DIR = `${process.env.HOME}/.cache/react-router-docs`;

// TypeDoc ReflectionKind bit flags.
const KINDS: Record<number, string> = {
  1: "Project", 2: "Module", 4: "Namespace", 8: "Enum", 16: "EnumMember",
  32: "Variable", 64: "Function", 128: "Class", 256: "Interface",
  512: "Constructor", 1024: "Property", 2048: "Method", 4096: "CallSignature",
  65536: "TypeLiteral", 262144: "Accessor", 2097152: "TypeAlias", 4194304: "Reference",
};

interface SymbolRow {
  name: string;
  kind: number;
  package: string;
  url: string;
}

interface Args {
  name?: string;
  kind?: string;
  pkg?: string;
  limit: number;
  exact?: boolean;
}

function printHelp(): void {
  console.error(`Usage: bun api.ts NAME [OPTIONS]

Options:
  --kind KIND        Filter by kind (Function, Interface, TypeAlias, Property,
                     Variable, Class, Method, Enum, Module, ...)
  --package PKG      Filter by owning package/parent (e.g. react-router,
                     @react-router/dev, react-router.dom)
  --exact            Exact (case-insensitive) name match only
  --limit N          Max results (default 20)
  -h, --help         Show this help

Examples:
  bun api.ts useLoaderData
  bun api.ts createBrowserRouter --exact
  bun api.ts Middleware
  bun api.ts --kind Interface --package @react-router/dev --limit 50
  bun api.ts unstable_ --limit 40

Exit codes: 0 ok · 1 cache missing or no matches · 2 invalid args`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 20 };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--kind") {
      const v = argv[++i];
      if (v === undefined) { console.error("Error: --kind needs a value"); process.exit(2); }
      args.kind = v.toLowerCase();
    } else if (a === "--package") {
      const v = argv[++i];
      if (v === undefined) { console.error("Error: --package needs a value"); process.exit(2); }
      args.pkg = v.toLowerCase();
    } else if (a === "--limit") {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        console.error(`Error: --limit must be a positive integer. Received: ${raw ?? "(nothing)"}`);
        process.exit(2);
      }
      args.limit = n;
    } else if (a === "--exact") args.exact = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else if (a.startsWith("--")) {
      console.error(`Error: unknown flag: ${a}`);
      printHelp();
      process.exit(2);
    } else positional.push(a);
  }
  if (positional.length > 0) args.name = positional.join(" ");
  return args;
}

const args = parseArgs(Bun.argv.slice(2));

if (args.name === undefined && args.kind === undefined && args.pkg === undefined) {
  console.error("Error: pass a NAME, or filter with --kind / --package.");
  printHelp();
  process.exit(2);
}

const symbolsFile = Bun.file(`${CACHE_DIR}/symbols.json`);
if (!(await symbolsFile.exists())) {
  console.error("Error: symbol index missing. Run: bun scripts/fetch.ts --verbose");
  process.exit(1);
}
const symbols = (await symbolsFile.json()) as SymbolRow[];

const needle = args.name?.toLowerCase();

const matches = symbols
  .filter((s) => {
    if (args.kind !== undefined && (KINDS[s.kind] ?? "").toLowerCase() !== args.kind) return false;
    if (args.pkg !== undefined && !s.package.toLowerCase().includes(args.pkg)) return false;
    if (needle === undefined) return true;
    const name = s.name.toLowerCase();
    return args.exact === true ? name === needle : name.includes(needle);
  })
  .map((s) => {
    const name = s.name.toLowerCase();
    // Exact name, then prefix, then substring — so `useFetcher` outranks
    // `useFetchers` and both outrank an interface that merely contains it.
    let rank = 0;
    if (needle !== undefined) {
      if (name === needle) rank = 3;
      else if (name.startsWith(needle)) rank = 2;
      else rank = 1;
    }
    // Top-level exports matter more than nested properties of an interface.
    const depth = s.package.split(".").length;
    return { s, rank, depth };
  })
  .sort((a, b) => b.rank - a.rank || a.depth - b.depth || a.s.name.localeCompare(b.s.name))
  .slice(0, args.limit);

if (matches.length === 0) {
  console.log(JSON.stringify({
    query: args.name ?? null,
    total: 0,
    results: [],
    hint: "Name is case-sensitive in the docs but matched case-insensitively here. Try a shorter fragment, or drop --kind/--package.",
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  query: args.name ?? null,
  filters: { kind: args.kind ?? null, package: args.pkg ?? null },
  total: matches.length,
  results: matches.map((m) => ({
    name: m.s.name,
    kind: KINDS[m.s.kind] ?? `Unknown(${m.s.kind})`,
    package: m.s.package === "" ? null : m.s.package,
    url: m.s.url,
  })),
}, null, 2));
