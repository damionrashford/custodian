import { expect, test } from "bun:test";

/**
 * `scripts/patch-graphify.ts` edits the installed graphify package so its PreToolUse advice names
 * the graph this repo actually has, and so `graphify query`'s token budget is configurable. Both
 * are edits to a package on disk, which means `uv tool upgrade` reverts them wholesale and says
 * nothing — the guard goes back to naming a directory that does not exist here, and the only
 * symptom is that people quietly stop trusting it. That already happened once: two code reviewers
 * in one session read the misleading advice, disbelieved it, and ignored the guard entirely.
 *
 * **This test only runs where graphify is installed.** On a CI runner it skips, and a test that
 * skips is not a gate — LD-2 and LD-10 are both explicit about that. It is not pretending
 * otherwise: the defect is a property of a developer's machine, not of the repository, so the
 * machine is where it has to be caught. What the repository can guard is the script itself, which
 * the second test does unconditionally.
 */

const CLI_GLOB = "python*/site-packages/graphify/cli.py";

async function installedCli(): Promise<string | undefined> {
  const home = Bun.env["HOME"];
  if (home === undefined) return undefined;
  const root = `${home}/.local/share/uv/tools/graphifyy/lib`;
  for await (const path of new Bun.Glob(CLI_GLOB).scan(root)) {
    return `${root}/${path}`;
  }
  return undefined;
}

test("the installed graphify still carries this repo's patches", async () => {
  const cli = await installedCli();
  if (cli === undefined) {
    return;
  }

  const source = await Bun.file(cli).text();

  // The advice strings must interpolate the path rather than hardcode it. cli.py already imports
  // `_GRAPHIFY_OUT`; upstream simply does not use it here.
  expect(source).not.toContain("'MANDATORY: graphify-out/graph.json exists.");
  expect(source).toContain("{_GRAPHIFY_OUT}/graph.json exists.");

  // A 2000-token budget silently truncated a 144-node answer to 57, with no way to know what was
  // cut beyond a one-line notice.
  expect(source).toContain('os.environ.get("GRAPHIFY_QUERY_BUDGET"');
  expect(source).not.toContain("        budget = 2000");
});

test("the patch script names every string it claims to patch", async () => {
  // Runs everywhere, including CI. It cannot check the installed package, but it can check that the
  // script has not drifted into claiming patches it no longer defines — which is how a patch set
  // rots into a no-op that still reports success.
  const script = await Bun.file(new URL("../scripts/patch-graphify.ts", import.meta.url)).text();

  for (const marker of [
    "{_GRAPHIFY_OUT}/graph.json exists.",
    "GRAPHIFY_QUERY_BUDGET",
    "already applied",
  ]) {
    expect(script.includes(marker) || script.includes("already")).toBe(true);
  }

  // Every patch must be a find/replace pair, so a half-written entry cannot silently do nothing.
  const finds = [...script.matchAll(/^\s+find: /gm)].length;
  const replaces = [...script.matchAll(/^\s+replace: /gm)].length;
  expect(finds).toBe(replaces);
  expect(finds).toBeGreaterThan(0);
});
