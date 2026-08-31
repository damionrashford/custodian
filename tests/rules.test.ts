import { expect, test } from "bun:test";

/**
 * `.claude/rules/` is instruction text, and instruction text rots in ways code does not: nothing
 * fails when a rule points at a file that was renamed, or when a `paths:` glob stops matching the
 * code it was written for. This repository has already paid for that twice — a section of
 * `CLAUDE.md` described a hook wrapper that no longer existed, and the guard it described had been
 * telling every session to look in an empty directory.
 *
 * These are the invariants that can be checked mechanically. What a rule *says* is a matter for
 * review; that it points somewhere real, and that it declares whether it is scoped, is not.
 */

const RULES_DIR = ".claude/rules";

/**
 * Rules that load on every session rather than against a path glob. Each must state why in its own
 * text, so the choice is visible to a reader rather than looking like an omission — every one of
 * these was scoped-out for a reason that would not survive being forgotten.
 */
const UNSCOPED = new Set(["data-protection.md", "locked-decisions.md", "pull-requests.md"]);

async function ruleFiles(): Promise<string[]> {
  const names: string[] = [];
  try {
    for await (const name of new Bun.Glob("*.md").scan({ cwd: RULES_DIR })) {
      names.push(name);
    }
  } catch {
    return [];
  }
  return names.sort();
}

async function readRule(name: string): Promise<string> {
  return Bun.file(new URL(`../${RULES_DIR}/${name}`, import.meta.url)).text();
}

function frontmatter(source: string): string | undefined {
  if (!source.startsWith("---\n")) return undefined;
  const end = source.indexOf("\n---\n", 4);
  return end === -1 ? undefined : source.slice(4, end);
}

test("the rules directory is not empty and is tracked", async () => {
  // `.claude/` was git-ignored wholesale until these files were published. If that regresses, this
  // test sees an empty directory rather than silently checking nothing.
  const files = await ruleFiles();
  expect(files.length).toBeGreaterThan(5);
});

test("every rule is either path-scoped or says why it is not", async () => {
  const unexplained: string[] = [];

  for (const name of await ruleFiles()) {
    const source = await readRule(name);
    const front = frontmatter(source);

    if (front === undefined) {
      // No frontmatter means it loads always, which is a decision that has to be stated.
      if (!UNSCOPED.has(name) || !source.includes("Deliberately unscoped")) {
        unexplained.push(`${name}: loads always, with no stated reason`);
      }
      continue;
    }

    if (!front.includes("paths:")) {
      unexplained.push(`${name}: has frontmatter but declares no paths`);
      continue;
    }
    // A `paths:` key with no entries is the worst case: it looks scoped and matches nothing, so the
    // rule silently never loads.
    if (!/^\s+-\s+"/m.test(front)) {
      unexplained.push(`${name}: declares paths with no patterns`);
    }
  }

  expect(unexplained).toEqual([]);
});

test("no rule references a sibling that does not exist", async () => {
  const present = new Set(await ruleFiles());
  const broken: string[] = [];

  for (const name of present) {
    const source = await readRule(name);
    for (const [, target] of source.matchAll(/`?([a-z-]+\.md)`?/g)) {
      if (target === undefined || target === name) continue;
      // Only names that look like rules files; a reference to CLAUDE.md or a corpus file is not one.
      if (!present.has(target) && /-|^[a-z]+\.md$/.test(target) && target.endsWith(".md")) {
        if (
          ["CLAUDE.md", "AGENTS.md", "README.md", "CHANGELOG.md", "LICENSE.md"].includes(target)
        ) {
          continue;
        }
        // A bare `foo.md` inside a rules file is a sibling reference unless it is one of the above.
        broken.push(`${name} -> ${target}`);
      }
    }
  }

  expect(broken).toEqual([]);
});

test("CLAUDE.md points at rules that exist", async () => {
  const present = new Set(await ruleFiles());
  const claudeMd = await Bun.file(new URL("../CLAUDE.md", import.meta.url)).text();

  const broken: string[] = [];
  for (const [, target] of claudeMd.matchAll(/\.claude\/rules\/([a-z-]+\.md)/g)) {
    if (target !== undefined && !present.has(target)) {
      broken.push(target);
    }
  }
  expect(broken).toEqual([]);
});
