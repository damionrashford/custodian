/**
 * Patches the installed graphify package so it behaves correctly under this repo's configuration.
 *
 * Two defects, both in `graphify/cli.py`, both of which cost this repo real time:
 *
 * 1. The PreToolUse advice strings hardcode `graphify-out/graph.json` even though `cli.py` already
 *    imports `_GRAPHIFY_OUT` from `graphify.paths` — the value that honours the `GRAPHIFY_OUT`
 *    environment variable this repo sets. So the guard told every session and subagent to look in a
 *    directory that does not exist here. Two code reviewers in one session read that text,
 *    disbelieved it, and ignored the guard entirely. The fix is to use the import that is already
 *    there.
 *
 * 2. `graphify query` hardcodes a 2000-token budget with no environment override, so a query that
 *    matches 144 nodes silently reports 57 of them. On a session with a large context window that
 *    truncation is pure loss, and the missing nodes are invisible — the answer may be among them and
 *    nothing says which. `GRAPHIFY_QUERY_BUDGET` now sets it, defaulting to the previous value.
 *
 * Run after every `graphify` upgrade. `uv tool upgrade` replaces the package wholesale, which
 * silently reverts both patches and restores the misleading advice — a reminder cannot catch that,
 * so `tests/graphify-patch.test.ts` asserts the patches are present.
 *
 * Idempotent: re-running on an already-patched install reports "already applied" and changes
 * nothing.
 */

const CLI = Bun.env["GRAPHIFY_CLI_PATH"] ?? (await locateCli());

type Patch = {
  readonly name: string;
  readonly find: string;
  readonly replace: string;
};

const PATCHES: readonly Patch[] = [
  {
    name: "search nudge honours GRAPHIFY_OUT",
    find: `            'MANDATORY: graphify-out/graph.json exists. You MUST run '`,
    replace: `            f'MANDATORY: {_GRAPHIFY_OUT}/graph.json exists. You MUST run '`,
  },
  {
    name: "read nudge honours GRAPHIFY_OUT",
    find: `            'MANDATORY: graphify-out/graph.json exists. You MUST run graphify '`,
    replace: `            f'MANDATORY: {_GRAPHIFY_OUT}/graph.json exists. You MUST run graphify '`,
  },
  {
    name: "stale-read nudge honours GRAPHIFY_OUT",
    find: `            'graphify-out/graph.json exists but may be STALE for this file (the file '`,
    replace: `            f'{_GRAPHIFY_OUT}/graph.json exists but may be STALE for this file (the file '`,
  },
  {
    name: "gemini nudge honours GRAPHIFY_OUT",
    find: `    'graphify: knowledge graph at graphify-out/. For focused questions, run '`,
    replace: `    f'graphify: knowledge graph at {_GRAPHIFY_OUT}/. For focused questions, run '`,
  },
  {
    name: "query budget reads GRAPHIFY_QUERY_BUDGET",
    find: `        budget = 2000`,
    replace: `        budget = int(os.environ.get("GRAPHIFY_QUERY_BUDGET", "2000"))`,
  },
];

async function locateCli(): Promise<string> {
  const home = Bun.env["HOME"] ?? "";
  const root = `${home}/.local/share/uv/tools/graphifyy/lib`;
  for await (const path of new Bun.Glob("python*/site-packages/graphify/cli.py").scan(root)) {
    return `${root}/${path}`;
  }
  throw new Error(
    `graphify cli.py not found under ${root}. Set GRAPHIFY_CLI_PATH to its location.`,
  );
}

const source = await Bun.file(CLI).text();
let patched = source;
const applied: string[] = [];
const already: string[] = [];
const missing: string[] = [];

for (const patch of PATCHES) {
  if (patched.includes(patch.replace)) {
    already.push(patch.name);
    continue;
  }
  if (!patched.includes(patch.find)) {
    missing.push(patch.name);
    continue;
  }
  patched = patched.replace(patch.find, patch.replace);
  applied.push(patch.name);
}

if (patched !== source) {
  await Bun.write(CLI, patched);
}

for (const name of applied) console.log(`applied     ${name}`);
for (const name of already) console.log(`already     ${name}`);
for (const name of missing) console.log(`NOT FOUND   ${name}`);

if (missing.length > 0) {
  console.error(
    `\n${String(missing.length)} patch(es) did not match. graphify's source changed; re-read ${CLI} and update scripts/patch-graphify.ts.`,
  );
  process.exit(1);
}
