import { expect, test } from "bun:test";

/**
 * The rules, the locked decisions and a good deal of the source cite the spec corpus by line —
 * `data-protection-and-retention.txt:74`, `implementation-plan.txt:65`. That is the right way to
 * cite a specification and it has one failure mode: the citation keeps parsing after the line it
 * points at has moved. Nothing breaks, the reader follows it to the wrong sentence, and the claim
 * the code makes about the spec quietly stops being true.
 *
 * Inserting a paragraph into a corpus file shifts every citation below it. This is why the corpus
 * is not edited to match the implementation — the direction of the relationship is that the code
 * conforms to the spec, and the line anchors are the mechanism that keeps the claim checkable.
 *
 * **Runs only where the corpus is present.** `.research/` is git-ignored and not ours to
 * redistribute, so on a CI runner this skips — the same honest limitation as the graphify patch
 * guard, and stated rather than hidden. The corpus lives on the machines that cite it, which is
 * where a broken anchor is introduced.
 */

const CORPUS = ".research";

/** Files superseded by a later revision. `.claude/agents/research.md` says never to cite them. */
const SUPERSEDED = ["implementation-plan-v1.txt", "gap-register-v1.txt"];

async function corpusFiles(): Promise<Map<string, number>> {
  const lineCounts = new Map<string, number>();
  try {
    for await (const name of new Bun.Glob("*.txt").scan({ cwd: CORPUS })) {
      const text = await Bun.file(new URL(`../${CORPUS}/${name}`, import.meta.url)).text();
      lineCounts.set(name, text.split("\n").length);
    }
  } catch {
    return lineCounts;
  }
  return lineCounts;
}

async function citingFiles(): Promise<string[]> {
  const paths: string[] = [];
  for (const pattern of ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts", "*.md"]) {
    for await (const path of new Bun.Glob(pattern).scan(".")) {
      paths.push(path);
    }
  }
  for await (const path of new Bun.Glob("rules/*.md").scan(".claude")) {
    paths.push(`.claude/${path}`);
  }
  // This file is excluded from its own check: it necessarily contains citation-shaped example text,
  // and a guard that fails on its own documentation is a guard people delete.
  return paths.filter((path) => !path.endsWith("corpus-citations.test.ts"));
}

/** `name.txt:12` and `name.txt:12-14` both cite a line; only the first number anchors it. */
const CITATION = /([a-z][a-z0-9-]*\.txt):(\d+)/g;

test("every corpus citation names a file that exists and a line within it", async () => {
  const corpus = await corpusFiles();
  if (corpus.size === 0) {
    return;
  }

  const broken: string[] = [];
  for (const path of await citingFiles()) {
    const source = await Bun.file(new URL(`../${path}`, import.meta.url)).text();
    for (const [, file, line] of source.matchAll(CITATION)) {
      if (file === undefined || line === undefined) continue;
      const lines = corpus.get(file);
      if (lines === undefined) {
        broken.push(`${path}: cites ${file}, which does not exist`);
      } else if (Number(line) > lines) {
        broken.push(`${path}: cites ${file}:${line}, past its ${String(lines)} lines`);
      }
    }
  }

  expect(broken).toEqual([]);
});

test("no superseded corpus revision is cited", async () => {
  const corpus = await corpusFiles();
  if (corpus.size === 0) {
    return;
  }

  // A v1 citation looks identical to a good one and points at reasoning a later revision replaced.
  // This found a real violation in `src/serving/application/execute-once.ts`, which cited the v1
  // plan for the idempotency rationale while the agent instructions said never to.
  const offenders: string[] = [];
  for (const path of await citingFiles()) {
    if (path.endsWith("research.md")) continue;
    const source = await Bun.file(new URL(`../${path}`, import.meta.url)).text();
    for (const superseded of SUPERSEDED) {
      if (source.includes(`${superseded}:`)) {
        offenders.push(`${path} -> ${superseded}`);
      }
    }
  }

  expect(offenders).toEqual([]);
});
