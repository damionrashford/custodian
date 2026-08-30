#!/usr/bin/env bun

/**
 * Run before a plant pass (LD-4: prove every gate can fail).
 *
 * A plant pass edits source, runs a test, and restores. Restoring with `git checkout <file>` is the
 * obvious move and it is unsafe: checkout reverts the file to HEAD, which discards any uncommitted
 * work in it along with the plant. That happened — two fixes written minutes earlier vanished, and
 * nothing failed, because reverting to a green HEAD leaves a green tree.
 *
 * The fix is not to remember. It is to make the restore safe by construction: with a clean tree,
 * `git checkout` can only undo the plant, because the plant is the only change.
 */
const status = Bun.spawnSync(["git", "status", "--porcelain"], { cwd: process.cwd() });
if (status.exitCode !== 0) {
  console.error("plant-guard: not a git repository, or git failed.");
  process.exit(2);
}

const dirty = new TextDecoder().decode(status.stdout).trim();
if (dirty.length > 0) {
  console.error(
    "plant-guard: the working tree has uncommitted changes, so restoring a plant would discard\n" +
      "them. Commit or stash first — a plant pass must start from a clean tree.\n\n" +
      dirty,
  );
  process.exit(1);
}

console.log("plant-guard: clean tree — a plant can be restored safely.");
