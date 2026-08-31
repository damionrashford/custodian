#!/usr/bin/env bun

/**
 * No standard linter covers prohibited folder names or folder-count budgets, so this is the
 * repository script engineering-standards.txt:215 calls for.
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

for await (const file of new Bun.Glob("src/*/**/*.ts").scan(".")) {
  const segments = file.split("/");
  const folder = segments.slice(0, -1).join("/");
  folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);

  for (const segment of segments) {
    const bare = segment.replace(/\.ts$/, "");
    if (PROHIBITED_SEGMENTS.has(bare)) {
      violations.push(`${file}: "${bare}" is a prohibited name (Engineering Standards §5).`);
    }
  }

  const depth = segments.length - 3;
  if (depth > MAX_DEPTH_FROM_SRC) {
    violations.push(
      `${file}: folder depth ${String(depth)} exceeds ${String(MAX_DEPTH_FROM_SRC)}.`,
    );
  }
}

/**
 * .dependency-cruiser.cjs lets a domain file import these package barrels and no others, on the
 * grounds that they export domain only. If one ever gains an infrastructure or application export
 * the exemption becomes a route from domain to an adapter, so the claim is checked rather than
 * trusted.
 */
const PURE_VOCABULARY_COMPONENTS: readonly string[] = ["primitives"];

for (const name of PURE_VOCABULARY_COMPONENTS) {
  const barrel = Bun.file(`src/${name}/index.ts`);
  const source = await barrel.text();
  if (/from "\.\/(infrastructure|application)\//.test(source)) {
    violations.push(
      `src/${name}/index.ts: listed as pure vocabulary in .dependency-cruiser.cjs but ` +
        `exports from infrastructure/ or application/. Either remove that export or drop the ` +
        `package from the exemption — domain files are allowed to import this barrel.`,
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
