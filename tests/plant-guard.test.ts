import { expect, test } from "bun:test";
// Sync writes: these helpers run inside sync test bodies, where an awaited Bun.write cannot go.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GUARD = join(import.meta.dir, "..", "scripts", "plant-guard.ts");

function run(command: string[], cwd: string): { code: number; err: string } {
  const spawned = Bun.spawnSync(command, { cwd });
  return { code: spawned.exitCode, err: new TextDecoder().decode(spawned.stderr) };
}

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "custodian-plant-"));
  run(["git", "init", "-q"], dir);
  run(["git", "config", "user.email", "test@example.test"], dir);
  run(["git", "config", "user.name", "test"], dir);
  writeFileSync(join(dir, "file.txt"), "committed\n");
  run(["git", "add", "-A"], dir);
  run(["git", "commit", "-qm", "seed"], dir);
  return dir;
}

test("a clean tree may be planted in", () => {
  expect(run(["bun", GUARD], repo()).code).toBe(0);
});

test("a dirty tree is refused, because restoring the plant would discard the work", () => {
  const dir = repo();
  writeFileSync(join(dir, "file.txt"), "uncommitted fix nobody wants reverted\n");

  // This is the exact shape of the failure: `git checkout file.txt` to undo a plant would take
  // this edit with it, and the tree would go green — the mistake leaves no trace of itself.
  const refused = run(["bun", GUARD], dir);
  expect(refused.code).toBe(1);
  expect(refused.err).toContain("uncommitted changes");
});

test("an untracked file counts as dirty too", () => {
  const dir = repo();
  writeFileSync(join(dir, "new.txt"), "not yet added\n");
  expect(run(["bun", GUARD], dir).code).toBe(1);
});
