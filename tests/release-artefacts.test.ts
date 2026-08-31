import { expect, test } from "bun:test";

/**
 * `CHANGELOG.md` and `README.md` are release artefacts, not afterthoughts, and CLAUDE.md has said
 * so in prose since the beginning. Prose did not hold: an entire build shipped with an empty
 * changelog, and the README claimed 355 tests while the suite stood at 517.
 *
 * The two failures have different shapes and need different gates. A changelog goes wrong by being
 * *absent* — nobody writes the entry — so the gate belongs in CI, where a pull request that touches
 * `src/` without touching `CHANGELOG.md` fails. A README goes wrong by being *stale*: the sentence
 * was true when written and quietly stopped being true, which no reviewer notices because nothing
 * about the diff looks wrong. That one has to be checked against the repository itself.
 *
 * This is LD-10's rule applied to documentation: a process failure becomes a test rather than a
 * reminder, because the person holding the reminder is the one who just forgot.
 */

async function readRepoFile(relative: string): Promise<string> {
  return Bun.file(new URL(`../${relative}`, import.meta.url)).text();
}

/** The only six section headings Keep a Changelog 1.1.0 permits. */
const CHANGE_TYPES: readonly string[] = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
];

test("the changelog keeps the six-heading structure it claims to follow", async () => {
  const changelog = await readRepoFile("CHANGELOG.md");

  // Declaring the format and then not following it is worse than not declaring it, because a reader
  // trusts the declaration rather than re-deriving the structure.
  expect(changelog).toContain("https://keepachangelog.com/en/1.1.0/");

  const headings = [...changelog.matchAll(/^### (.+)$/gm)].map(([, name]) => name);
  const illegal = headings.filter((name) => name !== undefined && !CHANGE_TYPES.includes(name));
  expect(illegal).toEqual([]);
});

test("there is exactly one Unreleased section, and it carries no date", async () => {
  const changelog = await readRepoFile("CHANGELOG.md");
  const unreleased = [...changelog.matchAll(/^## \[Unreleased\].*$/gm)].map(([line]) => line);

  expect(unreleased).toHaveLength(1);
  // A dated Unreleased section is a release someone forgot to name.
  expect(unreleased[0]).toBe("## [Unreleased]");
});

test("released versions are linkable and dated, newest first", async () => {
  const changelog = await readRepoFile("CHANGELOG.md");

  // Bracketed so the version resolves against a link definition. An unlinked heading reads fine and
  // silently loses the compare URL.
  const unlinked = [...changelog.matchAll(/^## (?!\[)(\d.*)$/gm)].map(([, v]) => v);
  expect(unlinked).toEqual([]);

  const dates = [...changelog.matchAll(/^## \[\d[^\]]*\] - (\d{4}-\d{2}-\d{2})$/gm)].map(
    ([, date]) => date,
  );
  expect([...dates].sort().reverse()).toEqual(dates);
});

test("the README's component count matches the components that exist", async () => {
  const readme = await readRepoFile("README.md");

  const components = new Set<string>();
  for await (const path of new Bun.Glob("src/*/").scan({ cwd: ".", onlyFiles: false })) {
    components.add(path);
  }

  const claimed = [...readme.matchAll(/(\d+) components/g)].map(([, n]) => Number(n));
  expect(claimed.length).toBeGreaterThan(0);
  for (const count of claimed) {
    expect(count).toBe(components.size);
  }
});

test("every component appears in the README's project structure", async () => {
  const readme = await readRepoFile("README.md");

  // The count and the listing drift independently: when `surfaces/` landed, the count said seven
  // and the tree listed seven, so the two agreed with each other and both were wrong. Checking the
  // names as well as the number is what closes that.
  const missing: string[] = [];
  for await (const path of new Bun.Glob("src/*/").scan({ cwd: ".", onlyFiles: false })) {
    const name = path.replace(/^src\//, "").replace(/\/$/, "");
    if (!readme.includes(`  ${name}/`)) {
      missing.push(name);
    }
  }
  expect(missing).toEqual([]);
});

test("the README states no count that the next commit invalidates", async () => {
  const readme = await readRepoFile("README.md");

  // A test count is true for exactly as long as nobody writes a test. It was wrong by 162 before
  // this gate existed. The CI badge reports the live state, so the number has nowhere to drift to.
  //
  // Component and layer counts are deliberately not on this list: they are checked against the
  // repository above, so they cannot drift silently.
  const drifting = [...readme.matchAll(/\b\d+ (tests|assertions|packages|dependencies)\b/g)].map(
    ([match]) => match,
  );
  expect(drifting).toEqual([]);
});

test("spelled-out counts are refused, because the count gate cannot read them", async () => {
  const readme = await readRepoFile("README.md");

  // "Seven components" reads better and is invisible to the check above, which is exactly how the
  // count reached 8 with the README still saying seven.
  const words = "one|two|three|four|five|six|seven|eight|nine|ten";
  const spelled = [...readme.matchAll(new RegExp(`\\b(${words}) components\\b`, "gi"))].map(
    ([match]) => match,
  );
  expect(spelled).toEqual([]);
});
