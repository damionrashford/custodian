#!/usr/bin/env bun
/**
 * check-readme.ts — deterministic checks over a generated README, so step 5 of the
 * workflow is a measured gate rather than a vibe. Read-only; never writes.
 *
 * Cross-checks the README against a scan-project.ts payload when one is supplied,
 * which is what catches the failure mode the skill exists to prevent: badges and
 * sections asserting things the repo does not actually have.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/check-readme.ts <README.md> [OPTIONS]
 *
 * Examples:
 *   bun scripts/check-readme.ts README.md
 *   bun scripts/check-readme.ts /tmp/draft.md --scan /tmp/scan.json
 *   bun scan-project.ts . --pretty > /tmp/scan.json && \
 *     bun scripts/check-readme.ts /tmp/draft.md --scan /tmp/scan.json --pretty
 *
 * Exit codes:
 *   0  no failures (warnings may still be present)
 *   1  at least one failure
 *   2  bad usage or unreadable input
 */

interface Args {
  readme: string;
  scan?: string;
  pretty: boolean;
}

interface Finding {
  level: "fail" | "warn";
  check: string;
  detail: string;
}

interface ScanShape {
  owner?: string;
  repo?: string;
  license?: string;
  package_manager?: string;
  is_git_repo?: boolean;
  ci?: { provider?: string; workflows?: string[] };
  social_links?: Record<string, string>;
}

const PLACEHOLDER_RE = /\{\{[A-Z0-9_]+\}\}|\bLorem ipsum\b|\bTODO\b|\bFIXME\b|\bXXX\b/g;

/** Marketing register — banned from user-facing copy by .claude/rules/design-standards.md. */
const MARKETING_RE =
  /\b(revolutionary|state[- ]of[- ]the[- ]art|cutting[- ]edge|blazing[- ]?fast|game[- ]chang(?:er|ing)|world[- ]class|next[- ]generation|seamlessly|effortlessly|supercharge|unleash|delightful|beautiful(?:ly)?|amazing|awesome|powerful|robust|best[- ]in[- ]class)\b/gi;

const SOCIAL_HOSTS: ReadonlyArray<readonly [string, RegExp]> = [
  ["youtube", /youtube\.com\//i],
  ["discord", /discord\.(gg|com\/invite)\//i],
  ["twitter", /(twitter\.com|x\.com)\//i],
  ["linkedin", /linkedin\.com\//i],
  ["bluesky", /bsky\.app\//i],
  ["twitch", /twitch\.tv\//i],
];

function printHelp(): void {
  console.error(`Usage: bun check-readme.ts <README.md> [OPTIONS]

Checks a README for leftover placeholders, marketing vocabulary, fabricated badges,
and install commands that disagree with the detected package manager.

Options:
  --scan <file>  scan-project.ts JSON to cross-check badges and links against
  --pretty       Indent the JSON report
  -h, --help     Show this help

Examples:
  bun check-readme.ts README.md
  bun check-readme.ts /tmp/draft.md --scan /tmp/scan.json --pretty

Exit codes:
  0  no failures
  1  at least one failure
  2  bad usage or unreadable input`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { readme: "", pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--pretty") args.pretty = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a === "--scan") {
      const next = argv[++i];
      if (next === undefined) {
        console.error("Error: --scan requires a file path");
        process.exit(2);
      }
      args.scan = next;
    } else if (a.startsWith("-")) {
      console.error(`Error: unknown flag: ${a}`);
      printHelp();
      process.exit(2);
    } else if (args.readme === "") {
      args.readme = a;
    } else {
      console.error(`Error: unexpected second positional argument: ${a}`);
      process.exit(2);
    }
  }
  if (args.readme === "") {
    console.error("Error: a README path is required");
    printHelp();
    process.exit(2);
  }
  return args;
}

const args = parseArgs(Bun.argv.slice(2));

const readmeFile = Bun.file(args.readme);
if (!(await readmeFile.exists())) {
  console.error(`Error: cannot read '${args.readme}'`);
  process.exit(2);
}
const readme = await readmeFile.text();

let scan: ScanShape | undefined;
if (args.scan !== undefined) {
  const scanFile = Bun.file(args.scan);
  if (!(await scanFile.exists())) {
    console.error(`Error: cannot read scan file '${args.scan}'`);
    process.exit(2);
  }
  try {
    scan = (await scanFile.json()) as ScanShape;
  } catch {
    console.error(`Error: '${args.scan}' is not valid JSON`);
    process.exit(2);
  }
}

const findings: Finding[] = [];
const fail = (check: string, detail: string): void => {
  findings.push({ level: "fail", check, detail });
};
const warn = (check: string, detail: string): void => {
  findings.push({ level: "warn", check, detail });
};

const lines = readme.split("\n");
const wordCount = readme.split(/\s+/).filter((w) => w !== "").length;

// ── content checks ─────────────────────────────────────────────────────────

if (readme.trim() === "") fail("non-empty", "README is empty");

const placeholders = [...new Set(readme.match(PLACEHOLDER_RE) ?? [])];
if (placeholders.length > 0) {
  fail("no-placeholders", `unresolved placeholder text: ${placeholders.join(", ")}`);
}

const marketing = [...new Set((readme.match(MARKETING_RE) ?? []).map((m) => m.toLowerCase()))];
if (marketing.length > 0) {
  fail("no-marketing-vocabulary", `marketing register banned by design-standards: ${marketing.join(", ")}`);
}

if (!/^#\s+\S/m.test(readme)) fail("has-title", "no level-1 heading found");

const headings = lines.filter((l) => /^#{2,3}\s+\S/.test(l)).map((l) => l.replace(/^#+\s+/, ""));
if (!headings.some((h) => /quick start|usage|getting started|install/i.test(h))) {
  warn("has-quick-start", "no Quick Start / Usage / Getting Started section");
}

// A heading followed only by blank lines, a horizontal rule, another heading, or
// EOF is a stub section — the template left in place with nothing written under it.
const isBlankish = (l: string): boolean => l.trim() === "" || /^\s*([-*_])\1{2,}\s*$/.test(l);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i] ?? "";
  if (!/^#{1,6}\s+\S/.test(line)) continue;
  let j = i + 1;
  while (j < lines.length && isBlankish(lines[j] ?? "")) j++;
  if (j >= lines.length || /^#{1,6}\s+\S/.test(lines[j] ?? "")) {
    fail("no-stub-sections", `section has no body: "${line.replace(/^#+\s+/, "")}"`);
  }
}

const badges = [...readme.matchAll(/https:\/\/img\.shields\.io\/\S*?(?=[)\s"'])/g)].map((m) => m[0]);
for (const badge of badges) {
  if (!badge.includes("style=for-the-badge")) {
    warn("badge-style", `badge missing style=for-the-badge: ${badge}`);
  }
}

if (wordCount > 1200) {
  warn("proportional-length", `${wordCount} words — verify the length matches the project's size`);
}

// ── cross-checks against the scan ──────────────────────────────────────────

if (scan !== undefined) {
  const hasRepo = (scan.owner ?? "") !== "" && (scan.repo ?? "") !== "";

  if (!hasRepo) {
    if (/img\.shields\.io\/github\//.test(readme)) {
      fail("no-github-badges-without-remote", "GitHub badge present but the scan found no owner/repo");
    }
    if (/contrib\.rocks/.test(readme)) {
      fail("no-contributor-avatars-without-remote", "contrib.rocks avatars require a GitHub remote");
    }
    if (/star-history\.com/.test(readme)) {
      fail("no-star-history-without-remote", "star history chart requires a GitHub remote");
    }
  }

  const ciWorkflows = scan.ci?.workflows ?? [];
  if (ciWorkflows.length === 0 && /shields\.io\/github\/actions\//.test(readme)) {
    fail("no-fabricated-ci-badge", "build badge present but the scan found no CI workflows");
  }

  if ((scan.license ?? "") === "" && /shields\.io\/github\/license/.test(readme)) {
    fail("no-fabricated-license-badge", "license badge present but the scan found no LICENSE file");
  }

  const known = Object.values(scan.social_links ?? {});
  for (const [name, host] of SOCIAL_HOSTS) {
    if (!host.test(readme)) continue;
    if (!known.some((url) => host.test(url))) {
      fail("no-fabricated-social-links", `${name} link present but not found by the scan`);
    }
  }

  const pm = scan.package_manager ?? "";
  const others = ["npm", "yarn", "pnpm", "bun", "pip", "poetry", "uv", "cargo", "go", "deno"].filter(
    (m) => m !== pm,
  );
  for (const other of others) {
    const cmd = new RegExp(`\`?\\b${other}\\s+(install|add|run|ci)\\b`);
    if (cmd.test(readme)) {
      if (pm === "") {
        warn("package-manager-match", `README uses '${other}' but the scan detected no package manager`);
      } else {
        fail("package-manager-match", `README uses '${other}' but the detected package manager is '${pm}'`);
      }
    }
  }
}

// ── report ─────────────────────────────────────────────────────────────────

const failures = findings.filter((f) => f.level === "fail");
const report = {
  readme: args.readme,
  scan: args.scan ?? null,
  word_count: wordCount,
  badge_count: badges.length,
  failures: failures.length,
  warnings: findings.length - failures.length,
  findings,
};

console.log(JSON.stringify(report, null, args.pretty ? 2 : 0));
process.exit(failures.length > 0 ? 1 : 0);
