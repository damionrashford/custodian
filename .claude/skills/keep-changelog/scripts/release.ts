#!/usr/bin/env bun
/**
 * release.ts — cut a release: move every [Unreleased] entry into a new dated
 * version section and rewrite the version link references.
 *
 * git is optional. Without a remote (or with --no-git) the compare-URL base is
 * taken from existing link references, then from --repo-url, and if neither
 * exists the link references are skipped with a warning rather than guessed.
 */

interface Args {
  file: string;
  version: string;
  date: string;
  repoUrl: string | null;
  tagPrefix: string;
  yanked: boolean;
  allowEmpty: boolean;
  force: boolean;
  noGit: boolean;
  dryRun: boolean;
  verbose: boolean;
}

function printHelp(): void {
  console.error(`Usage: bun release.ts --version X.Y.Z [OPTIONS]

Moves the contents of [Unreleased] into a new "## [X.Y.Z] - YYYY-MM-DD"
section, leaves [Unreleased] empty at the top, and rewrites the [unreleased]
and [X.Y.Z] link references. JSON summary on stdout, diagnostics on stderr.

Options:
  --version X.Y.Z   Version being released (required, bare semver, no "v")
  --file FILE       Changelog to edit (default: ./CHANGELOG.md)
  --date YYYY-MM-DD Release date (default: today, local time)
  --repo-url URL    Repository base URL for compare links, e.g.
                    https://github.com/owner/repo — only needed when the file
                    has no existing version link references
  --tag-prefix P    Tag prefix used in compare URLs (default: v; "" for none)
  --yanked          Mark the new section "[YANKED]"
  --allow-empty     Allow releasing with an empty [Unreleased] section
  --force           Allow a version that is not greater than the latest release
  --no-git          Never shell out to git to infer the repository URL
  --dry-run         Print the resulting file in the JSON "content" field, write nothing
  --verbose         Print progress to stderr
  -h, --help        Show this help

Exit codes:
  0  release applied (or previewed with --dry-run)
  1  refused — no [Unreleased] section, [Unreleased] is empty, version already
     present, or version not greater than the latest release
  2  usage error — unknown flag, missing/invalid value, file not found
  3  applied, but link references were skipped (no compare-URL base available)

Examples:
  bun release.ts --version 0.1.0 --file ./CHANGELOG.md --dry-run
  bun release.ts --version 0.1.0 --file ./CHANGELOG.md \\
      --repo-url https://github.com/olivierlacan/keep-a-changelog
  bun release.ts --version 1.0.0 --date 2026-01-15 --tag-prefix "" --file ./CHANGELOG.md`);
}

function todayIso(): string {
  const now = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

let tagPrefixExplicit = false;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    file: "CHANGELOG.md",
    version: "",
    date: todayIso(),
    repoUrl: null,
    tagPrefix: "v",
    yanked: false,
    allowEmpty: false,
    force: false,
    noGit: false,
    dryRun: false,
    verbose: false,
  };
  const need = (v: string | undefined, flag: string): string => {
    if (v === undefined) { console.error(`Error: ${flag} requires a value`); process.exit(2); }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--file") args.file = need(argv[++i], "--file");
    else if (a === "--version") args.version = need(argv[++i], "--version");
    else if (a === "--date") args.date = need(argv[++i], "--date");
    else if (a === "--repo-url") args.repoUrl = need(argv[++i], "--repo-url").replace(/\/+$/, "");
    else if (a === "--tag-prefix") { args.tagPrefix = need(argv[++i], "--tag-prefix"); tagPrefixExplicit = true; }
    else if (a === "--yanked") args.yanked = true;
    else if (a === "--allow-empty") args.allowEmpty = true;
    else if (a === "--force") args.force = true;
    else if (a === "--no-git") args.noGit = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else { console.error(`Error: unknown argument: ${a}`); printHelp(); process.exit(2); }
  }
  return args;
}

interface Semver { major: number; minor: number; patch: number; pre: string[] }

function parseSemver(raw: string): Semver | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(raw);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ? m[4].split(".") : [] };
}

function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.pre.length === 0 && b.pre.length > 0) return 1;
  if (a.pre.length > 0 && b.pre.length === 0) return -1;
  const n = Math.max(a.pre.length, b.pre.length);
  for (let i = 0; i < n; i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) { const d = Number(x) - Number(y); if (d !== 0) return d; }
    else if (xn !== yn) return xn ? -1 : 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function fail(message: string, code: 1 | 2): never {
  console.error(`Error: ${message}`);
  process.exit(code);
}

async function inferRepoUrl(cwd: string, verbose: boolean): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "-C", cwd, "config", "--get", "remote.origin.url"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const out = (await new Response(proc.stdout).text()).trim();
    if ((await proc.exited) !== 0 || out === "") return null;
    const ssh = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(out);
    if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
    return out.replace(/\.git$/, "");
  } catch (err) {
    if (verbose) console.error(`git remote lookup unavailable: ${String(err)}`);
    return null;
  }
}

const args = parseArgs(Bun.argv.slice(2));

if (args.version === "") { console.error("Error: --version is required"); printHelp(); process.exit(2); }
const newSemver = parseSemver(args.version.replace(/^v/, ""));
if (!newSemver) fail(`--version "${args.version}" is not a valid Semantic Version (MAJOR.MINOR.PATCH)`, 2);
const version = args.version.replace(/^v/, "");
if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) fail(`--date "${args.date}" is not ISO 8601 YYYY-MM-DD`, 2);

const file = Bun.file(args.file);
if (!(await file.exists())) fail(`file not found: ${args.file}`, 2);
const original = await file.text();
const lines = original.split(/\r?\n/);

// Locate the [Unreleased] heading and its body.
let unreleasedLine = -1;
let unreleasedHeading = "";
for (let i = 0; i < lines.length; i++) {
  const m = /^##\s+\[?unreleased\]?\s*$/i.exec(lines[i] ?? "");
  if (m) { unreleasedLine = i; unreleasedHeading = lines[i] ?? ""; break; }
}
if (unreleasedLine === -1) {
  fail(`no "## [Unreleased]" section in ${args.file}. Add one (see assets/changelog-template.md) before cutting a release.`, 1);
}

let bodyEnd = lines.length;
for (let i = unreleasedLine + 1; i < lines.length; i++) {
  const l = lines[i] ?? "";
  if (/^##\s+/.test(l) || /^\[[^\]]+\]:\s*\S/.test(l)) { bodyEnd = i; break; }
}
const body = lines.slice(unreleasedLine + 1, bodyEnd);
const bodyText = body.join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
const entryCount = body.filter((l) => /^\s{0,3}[-*+]\s+\S/.test(l)).length;

if (entryCount === 0 && !args.allowEmpty) {
  fail(`[Unreleased] has no entries in ${args.file}. Nothing to release — add entries or pass --allow-empty.`, 1);
}

// Existing released versions, latest first.
const existing: Array<{ id: string; semver: Semver | null }> = [];
for (const l of lines) {
  const m = /^##\s+\[?([^\]\s]+)\]?/.exec(l ?? "");
  const id = m?.[1];
  if (!id || /^unreleased$/i.test(id)) continue;
  existing.push({ id, semver: parseSemver(id.replace(/^v/, "")) });
}
if (existing.some((e) => e.id.replace(/^v/, "") === version)) {
  fail(`version ${version} already has a section in ${args.file}.`, 1);
}
const latest = existing[0];
if (latest?.semver && compareSemver(newSemver, latest.semver) <= 0 && !args.force) {
  fail(`version ${version} is not greater than the latest release ${latest.id}. Pass --force to override.`, 1);
}

// Compare-URL base: existing refs → --repo-url → git remote → skip.
const refLines: Array<{ index: number; id: string; url: string }> = [];
for (let i = 0; i < lines.length; i++) {
  const m = /^\[([^\]]+)\]:\s*(\S+)/.exec(lines[i] ?? "");
  if (m && m[1] !== undefined && m[2] !== undefined) refLines.push({ index: i, id: m[1], url: m[2] });
}
const unreleasedRef = refLines.find((r) => /^unreleased$/i.test(r.id));

let compareBase: string | null = null;
let tagPrefix = args.tagPrefix;
let baseSource = "none";
const learnPrefix = (tagText: string): void => {
  if (tagPrefixExplicit) return;
  const pm = /^([^0-9]*)\d/.exec(tagText);
  if (pm && pm[1] !== undefined) tagPrefix = pm[1];
};
const fromRef = (url: string): string | null => {
  const ci = url.indexOf("/compare/");
  if (ci !== -1) {
    const rest = url.slice(ci + "/compare/".length);
    learnPrefix(rest.split("...")[0] ?? "");
    return url.slice(0, ci);
  }
  const ti = url.indexOf("/releases/tag/");
  if (ti !== -1) {
    learnPrefix(url.slice(ti + "/releases/tag/".length));
    return url.slice(0, ti);
  }
  return null;
};
for (const r of [unreleasedRef, ...refLines].filter((r): r is { index: number; id: string; url: string } => r !== undefined)) {
  const base = fromRef(r.url);
  if (base) { compareBase = base; baseSource = `link-ref [${r.id}]`; break; }
}
if (!compareBase && args.repoUrl) { compareBase = args.repoUrl; baseSource = "--repo-url"; }
if (!compareBase && !args.noGit) {
  const inferred = await inferRepoUrl(args.file.replace(/\/[^/]*$/, "") || ".", args.verbose);
  if (inferred) { compareBase = inferred; baseSource = "git remote.origin.url"; }
  else if (args.verbose) console.error("git remote unavailable (not a git repository or no origin) — continuing without it.");
}

const tag = (v: string): string => `${tagPrefix}${v}`;
const unreleasedRefId = unreleasedRef?.id ?? "unreleased";
let linkRefsWritten = false;
const newRefs: Record<string, string> = {};
if (compareBase) {
  newRefs[unreleasedRefId] = `${compareBase}/compare/${tag(version)}...HEAD`;
  newRefs[version] = latest
    ? `${compareBase}/compare/${tag(latest.id.replace(/^v/, ""))}...${tag(version)}`
    : `${compareBase}/releases/tag/${tag(version)}`;
  linkRefsWritten = true;
} else {
  console.error(
    "Warning: no compare-URL base found (no existing version link references, no --repo-url, no git remote). " +
      "Skipping link references — add them by hand or re-run with --repo-url.",
  );
}

// Rebuild the file.
const heading = `## [${version}] - ${args.date}${args.yanked ? " [YANKED]" : ""}`;
const out: string[] = [];
out.push(...lines.slice(0, unreleasedLine));
out.push(unreleasedHeading);
out.push("");
out.push(heading);
out.push("");
if (bodyText !== "") out.push(bodyText, "");

const tailStart = bodyEnd;
const tail = lines.slice(tailStart);
// Drop a leading blank run so spacing stays uniform.
let t = 0;
while (t < tail.length && (tail[t] ?? "").trim() === "") t++;
const tailBody = tail.slice(t);

const rewritten: string[] = [];
let insertedNewRef = false;
let firstRefSeen = false;
for (const l of tailBody) {
  const m = /^\[([^\]]+)\]:\s*\S+/.exec(l);
  if (m && m[1] !== undefined && linkRefsWritten) {
    const id = m[1];
    if (/^unreleased$/i.test(id)) {
      rewritten.push(`[${id}]: ${newRefs[unreleasedRefId]}`);
      if (!insertedNewRef) { rewritten.push(`[${version}]: ${newRefs[version]}`); insertedNewRef = true; }
      firstRefSeen = true;
      continue;
    }
    if (!firstRefSeen && !insertedNewRef) {
      rewritten.push(`[${version}]: ${newRefs[version]}`);
      insertedNewRef = true;
    }
    firstRefSeen = true;
  }
  rewritten.push(l);
}
if (linkRefsWritten && !insertedNewRef) {
  while (rewritten.length > 0 && (rewritten[rewritten.length - 1] ?? "").trim() === "") rewritten.pop();
  rewritten.push("");
  if (!refLines.some((r) => /^unreleased$/i.test(r.id))) {
    rewritten.push(`[${unreleasedRefId}]: ${newRefs[unreleasedRefId]}`);
  }
  rewritten.push(`[${version}]: ${newRefs[version]}`);
}
out.push(...rewritten);

let content = out.join("\n").replace(/\n{3,}/g, "\n\n");
if (!content.endsWith("\n")) content += "\n";

if (!args.dryRun) {
  await Bun.write(args.file, content);
  if (args.verbose) console.error(`Wrote ${args.file}`);
} else if (args.verbose) {
  console.error("[dry-run] no file written");
}

const summary = {
  file: args.file,
  version,
  date: args.date,
  yanked: args.yanked,
  entriesMoved: entryCount,
  previousVersion: latest?.id ?? null,
  linkRefs: linkRefsWritten ? { source: baseSource, tagPrefix, ...newRefs } : null,
  linkRefsSkipped: !linkRefsWritten,
  wrote: !args.dryRun,
  ...(args.dryRun ? { content } : {}),
};
console.log(JSON.stringify(summary, null, 2));
process.exit(linkRefsWritten ? 0 : 3);
