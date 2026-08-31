import { expect, test } from "bun:test";

/**
 * Guards the Dockerfile against the failure that actually happened: `tsconfig.base.json` was merged
 * into `tsconfig.json`, and the `COPY` naming it survived one commit. The build broke, `bun run
 * verify` stayed green, and nothing noticed — because CI did not build the image at all.
 *
 * CI builds it now, in a job that is deliberately **not** a required check: a docker build pulls a
 * base image over the network, and LD-10 is explicit that a network dependency in a blocking
 * position is worse than no gate, because a gate that fires at random teaches people to click
 * through red CI.
 *
 * These tests are the blocking half. They read the Dockerfile as text and check every path it
 * copies actually exists, which needs no daemon, no network, and about a millisecond — so the
 * specific defect that got through is caught by the gate that always runs, and the real build stays
 * where a flaky pull cannot block a merge.
 */

async function readRepoFile(relative: string): Promise<string> {
  return Bun.file(new URL(`../${relative}`, import.meta.url)).text();
}

async function exists(relative: string): Promise<boolean> {
  const path = new URL(`../${relative}`, import.meta.url);
  if (await Bun.file(path).exists()) return true;
  // Bun.file().exists() is false for a directory, and the Dockerfile copies `src`.
  try {
    for await (const _ of new Bun.Glob("*").scan({ cwd: path.pathname, onlyFiles: false })) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

test("every path the Dockerfile copies exists in the repository", async () => {
  const dockerfile = await readRepoFile("docker/Dockerfile");

  const missing: string[] = [];
  for (const [, args] of dockerfile.matchAll(/^COPY\s+(.+)$/gm)) {
    if (args === undefined) continue;
    // The last token is the destination inside the image; everything before it is a source path.
    const tokens = args.trim().split(/\s+/);
    for (const source of tokens.slice(0, -1)) {
      if (source.startsWith("--")) continue;
      if (!(await exists(source))) {
        missing.push(source);
      }
    }
  }

  expect(missing).toEqual([]);
});

test("the compose file builds from the repository root, not from docker/", async () => {
  const compose = await readRepoFile("docker/compose.yaml");

  // The image copies `src/`, which lives one level up from this file. A `context: .` here would
  // resolve to `docker/` and fail on the first COPY — and it would fail only when someone runs a
  // build, which is exactly the delay this file exists to remove.
  expect(compose).not.toMatch(/^\s*build:\s*\.\s*$/m);
  expect(compose).toContain("context: ..");
  expect(compose).toContain("dockerfile: docker/Dockerfile");
});

test("the build context excludes what must never ship", async () => {
  const ignore = await readRepoFile("docker/Dockerfile.dockerignore");

  // BuildKit reads `<dockerfile>.dockerignore` in preference to a root `.dockerignore`, so this
  // file is the one that applies. If it were ever renamed or lost, the build would silently start
  // shipping the spec corpus, the machine-local decisions, and any developer's sealed databases.
  for (const secret of [".research/", ".claude/", ".env", "*.sqlite", "tests/", "node_modules/"]) {
    expect(ignore).toContain(secret);
  }
});
