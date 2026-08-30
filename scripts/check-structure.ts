#!/usr/bin/env bun

/**
 * No standard linter covers prohibited folder names or folder-count budgets, so this is the
 * repository script Engineering_Standards.txt:215 calls for.
 */
const PROHIBITED_SEGMENTS: ReadonlySet<string> = new Set([
  "utils",
  "helpers",
  "common",
  "shared",
  "misc",
  "manager",
  "data",
]);
const MAX_FILES_PER_FOLDER = 15;
const MAX_DEPTH_FROM_SRC = 5;

const violations: string[] = [];
const folderCounts = new Map<string, number>();

for await (const file of new Bun.Glob("packages/*/src/**/*.ts").scan(".")) {
  const segments = file.split("/");
  const folder = segments.slice(0, -1).join("/");
  folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);

  for (const segment of segments) {
    const bare = segment.replace(/\.ts$/, "");
    if (PROHIBITED_SEGMENTS.has(bare)) {
      violations.push(`${file}: "${bare}" is a prohibited name (Engineering Standards §5).`);
    }
  }

  const srcIndex = segments.indexOf("src");
  const depth = segments.length - srcIndex - 2;
  if (depth > MAX_DEPTH_FROM_SRC) {
    violations.push(
      `${file}: folder depth ${String(depth)} exceeds ${String(MAX_DEPTH_FROM_SRC)}.`,
    );
  }
}

for (const [folder, count] of folderCounts) {
  if (count > MAX_FILES_PER_FOLDER) {
    violations.push(
      `${folder}: ${String(count)} files exceeds hard stop ${String(MAX_FILES_PER_FOLDER)}.`,
    );
  }
}

for (const violation of violations) {
  console.error(violation);
}
process.exit(violations.length === 0 ? 0 : 1);
