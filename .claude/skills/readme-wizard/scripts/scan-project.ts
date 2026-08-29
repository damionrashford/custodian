#!/usr/bin/env bun
/**
 * scan-project.ts — collect structured JSON metadata about a project for README generation.
 *
 * Bun/TypeScript port of scan_project.sh from debs-obrien/learn-agent-skills.
 * Git is optional: a repo with no .git directory and no remote scans fine and
 * returns empty `owner`/`repo`, which suppresses every GitHub-dependent badge.
 *
 * Usage:
 *   bun ${CLAUDE_SKILL_DIR}/scripts/scan-project.ts [DIR] [OPTIONS]
 *
 * Examples:
 *   bun scripts/scan-project.ts
 *   bun scripts/scan-project.ts /Users/me/Projects/prod-agent
 *   bun scripts/scan-project.ts . --no-network --verbose
 *   bun scripts/scan-project.ts . --pretty > /tmp/scan.json
 *
 * Exit codes:
 *   0  scan completed, JSON on stdout
 *   1  target is not a readable directory
 *   2  bad usage (unknown flag, duplicate directory argument)
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const SOCIAL_PATTERNS = {
  youtube:
    /https?:\/\/(?:www\.)?youtube\.com\/(?:@[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9_-]+|channel\/[a-zA-Z0-9_-]+)/i,
  discord: /https?:\/\/(?:www\.)?discord\.(?:gg|com\/invite)\/[a-zA-Z0-9_-]+/i,
  twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9_-]+/i,
  bluesky: /https?:\/\/bsky\.app\/profile\/[a-zA-Z0-9._-]+/i,
  twitch: /https?:\/\/(?:www\.)?twitch\.tv\/[a-zA-Z0-9_]+/i,
} as const;

type SocialKey = keyof typeof SOCIAL_PATTERNS;

const PACKAGE_MANAGERS: ReadonlyArray<readonly [string, string]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["Cargo.lock", "cargo"],
  ["Pipfile.lock", "pipenv"],
  ["poetry.lock", "poetry"],
  ["uv.lock", "uv"],
  ["requirements.txt", "pip"],
  ["go.sum", "go"],
  ["go.mod", "go"],
  ["build.gradle", "gradle"],
  ["build.gradle.kts", "gradle"],
  ["deno.json", "deno"],
  ["deno.jsonc", "deno"],
];

const LICENSE_MATCHERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bMIT\b/i, "MIT"],
  [/\bApache\b/i, "Apache-2.0"],
  [/\bGPL\b/i, "GPL"],
  [/\bBSD\b/i, "BSD"],
  [/\bISC\b/i, "ISC"],
];

/**
 * Never list a credential-bearing filename in a structure tree — a README is a
 * published artefact, and naming these files there is an information disclosure
 * even though their contents are never read.
 */
const SECRET_FILE_RE = /^(\.env(\..*)?|.*\.(pem|key|p12|pfx)|id_rsa.*|id_ed25519.*|\.npmrc|\.netrc)$/i;

const PRUNED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "target",
  "__pycache__",
  "venv",
  ".venv",
]);

interface Args {
  dir: string;
  includeHidden: boolean;
  noNetwork: boolean;
  pretty: boolean;
  verbose: boolean;
}

interface Scan {
  project_name: string;
  description: string;
  license: string;
  owner: string;
  repo: string;
  package_manager: string;
  is_git_repo: boolean;
  ci: { provider: string; workflows: string[] };
  social_links: Partial<Record<SocialKey, string>>;
  directory_structure: string;
  docs: string[];
  notes: string[];
}

function printHelp(): void {
  console.error(`Usage: bun scan-project.ts [DIR] [OPTIONS]

Scans DIR (default: current directory) and prints README metadata as JSON to stdout.

Options:
  --include-hidden  Include dot-directories in the structure tree (.git is always skipped).
                    Needed for repos whose substance lives in hidden dirs, e.g. .research/
  --no-network      Skip the GitHub API homepage lookup and homepage crawl
  --pretty          Indent the JSON output
  --verbose         Print progress to stderr
  -h, --help        Show this help

Examples:
  bun scan-project.ts
  bun scan-project.ts /Users/me/Projects/prod-agent --pretty
  bun scan-project.ts . --no-network --verbose
  bun scan-project.ts . --include-hidden --no-network --pretty

Exit codes:
  0  scan completed, JSON on stdout
  1  target is not a readable directory
  2  bad usage`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dir: ".",
    includeHidden: false,
    noNetwork: false,
    pretty: false,
    verbose: false,
  };
  let sawDir = false;
  for (const a of argv) {
    if (a === "--include-hidden") args.includeHidden = true;
    else if (a === "--no-network") args.noNetwork = true;
    else if (a === "--pretty") args.pretty = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("-")) {
      console.error(`Error: unknown flag: ${a}`);
      printHelp();
      process.exit(2);
    } else if (sawDir) {
      console.error(`Error: unexpected second directory argument: ${a}`);
      process.exit(2);
    } else {
      args.dir = a;
      sawDir = true;
    }
  }
  return args;
}

const args = parseArgs(Bun.argv.slice(2));
const log = (msg: string): void => {
  if (args.verbose) console.error(msg);
};

const root = resolve(args.dir);
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`Error: '${args.dir}' is not a directory`);
  process.exit(1);
}

async function readIfExists(path: string): Promise<string | undefined> {
  const file = Bun.file(path);
  return (await file.exists()) ? await file.text() : undefined;
}

function firstMatch(text: string, re: RegExp): string {
  const m = re.exec(text);
  return m?.[1]?.trim() ?? "";
}

async function detectNameAndDescription(): Promise<{ name: string; description: string }> {
  const pkg = await readIfExists(join(root, "package.json"));
  if (pkg !== undefined) {
    try {
      const parsed: unknown = JSON.parse(pkg);
      if (typeof parsed === "object" && parsed !== null) {
        const rec = parsed as Record<string, unknown>;
        const name = typeof rec["name"] === "string" ? rec["name"] : "";
        const description = typeof rec["description"] === "string" ? rec["description"] : "";
        if (name !== "") return { name, description };
      }
    } catch {
      log("package.json is not valid JSON; falling back to directory name");
    }
  }

  for (const file of ["Cargo.toml", "pyproject.toml"]) {
    const text = await readIfExists(join(root, file));
    if (text === undefined) continue;
    const name = firstMatch(text, /^\s*name\s*=\s*"([^"]*)"/m);
    const description = firstMatch(text, /^\s*description\s*=\s*"([^"]*)"/m);
    if (name !== "") return { name, description };
  }

  const goMod = await readIfExists(join(root, "go.mod"));
  if (goMod !== undefined) {
    const modulePath = firstMatch(goMod, /^module\s+(\S+)/m).replace(/\/v\d+$/, "");
    if (modulePath !== "") return { name: basename(modulePath), description: "" };
  }

  return { name: basename(root), description: "" };
}

async function detectLicense(): Promise<string> {
  for (const file of ["LICENSE", "LICENSE.md", "LICENSE.txt"]) {
    const text = await readIfExists(join(root, file));
    if (text === undefined) continue;
    const head = text.split("\n").slice(0, 5).join("\n");
    for (const [re, label] of LICENSE_MATCHERS) if (re.test(head)) return label;
    return `Found (${file})`;
  }
  return "";
}

/**
 * Git is optional here: this repo may have no .git at all. `git` is invoked only
 * after a .git directory is confirmed, and a non-zero exit is treated as "no remote"
 * rather than an error, so the scan always produces usable output.
 */
async function detectGitRemote(): Promise<{ owner: string; repo: string; isRepo: boolean }> {
  if (!existsSync(join(root, ".git"))) {
    log("no .git directory — skipping git remote detection");
    return { owner: "", repo: "", isRepo: false };
  }
  const proc = Bun.spawn(["git", "remote", "get-url", "origin"], {
    cwd: root,
    stdout: "pipe",
    stderr: "ignore",
  });
  const out = (await new Response(proc.stdout).text()).trim();
  await proc.exited;
  if (proc.exitCode !== 0 || out === "") {
    log("git repo present but no origin remote — owner/repo left empty");
    return { owner: "", repo: "", isRepo: true };
  }
  const ownerRepo = out
    .replace(/^git@[^:]+:/, "")
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/\.git$/, "");
  const [owner = "", repo = ""] = ownerRepo.split("/");
  return { owner, repo, isRepo: true };
}

function detectPackageManager(): string {
  for (const [file, manager] of PACKAGE_MANAGERS) {
    if (existsSync(join(root, file))) return manager;
  }
  return "";
}

function detectCi(): { provider: string; workflows: string[] } {
  const workflowDir = join(root, ".github", "workflows");
  if (existsSync(workflowDir) && statSync(workflowDir).isDirectory()) {
    const workflows = readdirSync(workflowDir)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .sort();
    // An empty .github/workflows directory is not a CI setup — claiming one here
    // is exactly the fabricated-badge failure the skill exists to prevent.
    if (workflows.length > 0) return { provider: "github-actions", workflows };
    return { provider: "", workflows: [] };
  }
  for (const [file, provider] of [
    [".circleci/config.yml", "circleci"],
    [".travis.yml", "travis"],
    [".gitlab-ci.yml", "gitlab"],
    ["Jenkinsfile", "jenkins"],
  ] as const) {
    if (existsSync(join(root, file))) return { provider, workflows: [] };
  }
  return { provider: "", workflows: [] };
}

function scrapeSocial(text: string, into: Partial<Record<SocialKey, string>>): void {
  for (const key of Object.keys(SOCIAL_PATTERNS) as SocialKey[]) {
    if (into[key] !== undefined) continue;
    const m = SOCIAL_PATTERNS[key].exec(text);
    if (m !== null) into[key] = m[0];
  }
}

async function collectSocialLinks(
  owner: string,
  repo: string,
): Promise<Partial<Record<SocialKey, string>>> {
  const found: Partial<Record<SocialKey, string>> = {};
  for (const file of ["README.md", "README.rst", "README", "readme.md", "package.json"]) {
    const text = await readIfExists(join(root, file));
    if (text !== undefined) scrapeSocial(text, found);
  }

  if (args.noNetwork || owner === "" || repo === "") return found;

  try {
    const api = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/vnd.github+json" },
    });
    if (!api.ok) {
      log(`GitHub API returned ${api.status} — skipping homepage enrichment`);
      return found;
    }
    const body: unknown = await api.json();
    const homepage =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)["homepage"]
        : undefined;
    if (typeof homepage !== "string" || homepage === "") return found;

    log(`crawling homepage ${homepage} for social links`);
    const page = await fetch(homepage, {
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (page.ok) scrapeSocial(await page.text(), found);
  } catch (err) {
    log(`social enrichment skipped: ${err instanceof Error ? err.message : String(err)}`);
  }
  return found;
}

/**
 * Top two levels, directories before files, alphabetical within each group.
 * Hidden entries are excluded unless --include-hidden, which matters for repos
 * whose real content sits in dot-directories.
 */
function buildDirectoryStructure(): string {
  const lines: string[] = [];

  const listing = (dir: string): { dirs: string[]; files: string[] } => {
    const dirs: string[] = [];
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      if (entry.name.startsWith(".") && !args.includeHidden) continue;
      if (entry.isDirectory()) {
        if (!PRUNED_DIRS.has(entry.name)) dirs.push(entry.name);
      } else if (!entry.name.endsWith(".pyc") && !SECRET_FILE_RE.test(entry.name)) {
        files.push(entry.name);
      }
    }
    return { dirs: dirs.sort(), files: files.sort() };
  };

  const top = listing(root);
  for (const dir of top.dirs) {
    lines.push(`${dir}/`);
    const child = listing(join(root, dir));
    for (const sub of child.dirs) lines.push(`${dir}/${sub}/`);
    for (const file of child.files) lines.push(`${dir}/${file}`);
  }
  for (const file of top.files) lines.push(file);
  return lines.slice(0, 50).join("\n");
}

/** Markdown files at the top level plus docs/ — candidates for the documentation table. */
function collectDocs(): string[] {
  const docs: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) docs.push(entry.name);
  }
  const docsDir = join(root, "docs");
  if (existsSync(docsDir) && statSync(docsDir).isDirectory()) {
    for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) docs.push(`docs/${entry.name}`);
    }
  }
  return docs.sort();
}

const { name, description } = await detectNameAndDescription();
const { owner, repo, isRepo } = await detectGitRemote();
const license = await detectLicense();
const social = await collectSocialLinks(owner, repo);
const ci = detectCi();

const notes: string[] = [];
if (!isRepo) {
  notes.push(
    "Not a git repository: omit contributor avatars, star history, and every GitHub-hosted badge.",
  );
} else if (owner === "" || repo === "") {
  notes.push("No git origin remote: omit contributor avatars, star history, and GitHub badges.");
}
if (ci.provider === "") notes.push("No CI detected: do not add a build badge.");
if (license === "") notes.push("No LICENSE file found: omit the license badge and section.");
if (Object.keys(social).length === 0) {
  notes.push("No social links found: omit the Connect section entirely.");
}
if (description === "") {
  notes.push("No machine-readable description: write one from the repo's own docs, do not invent.");
}

const scan: Scan = {
  project_name: name,
  description,
  license,
  owner,
  repo,
  package_manager: detectPackageManager(),
  is_git_repo: isRepo,
  ci,
  social_links: social,
  directory_structure: buildDirectoryStructure(),
  docs: collectDocs(),
  notes,
};

console.log(JSON.stringify(scan, null, args.pretty ? 2 : 0));
