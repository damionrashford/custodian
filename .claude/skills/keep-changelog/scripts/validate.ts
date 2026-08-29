#!/usr/bin/env bun
/**
 * validate.ts — parse a CHANGELOG.md and report Keep a Changelog 1.1.0 spec
 * violations as JSON on stdout.
 *
 * Pure text analysis. No git, no network, no npm dependencies.
 */

type Severity = "error" | "warning";

interface Finding {
  rule: string;
  severity: Severity;
  line: number;
  message: string;
}

interface RuleDoc {
  rule: string;
  severity: Severity;
  description: string;
}

const CHANGE_TYPES = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
] as const;

const RULES: RuleDoc[] = [
  { rule: "file-empty", severity: "error", description: "File is empty or whitespace only." },
  { rule: "missing-h1", severity: "error", description: "No top-level `# Changelog` heading." },
  { rule: "missing-unreleased", severity: "error", description: "No `## [Unreleased]` section." },
  { rule: "unreleased-not-first", severity: "error", description: "`## [Unreleased]` is not the first version section." },
  { rule: "malformed-version-heading", severity: "error", description: "`##` heading is not `[Version] - YYYY-MM-DD` shaped." },
  { rule: "unlinked-version-heading", severity: "error", description: "Version in a `##` heading is not wrapped in [brackets] (versions must be linkable)." },
  { rule: "invalid-semver", severity: "error", description: "Version is not a valid Semantic Version." },
  { rule: "missing-date", severity: "error", description: "Released version has no release date." },
  { rule: "invalid-date-format", severity: "error", description: "Date is not ISO 8601 `YYYY-MM-DD`." },
  { rule: "invalid-date-value", severity: "error", description: "Date is `YYYY-MM-DD` shaped but not a real calendar date." },
  { rule: "duplicate-version", severity: "error", description: "The same version appears in more than one heading." },
  { rule: "versions-out-of-order", severity: "error", description: "Versions are not in descending (latest-first) order." },
  { rule: "unknown-change-type", severity: "error", description: "`###` heading is not one of Added/Changed/Deprecated/Removed/Fixed/Security." },
  { rule: "duplicate-change-type", severity: "error", description: "The same change type appears twice inside one version." },
  { rule: "entry-outside-change-type", severity: "error", description: "Bullet entry sits under a version heading with no `###` change type above it." },
  { rule: "missing-link-ref", severity: "error", description: "Version heading has no matching `[version]: url` link reference." },
  { rule: "missing-intro-notice", severity: "warning", description: "Intro does not state that the format follows Keep a Changelog and/or Semantic Versioning." },
  { rule: "empty-change-section", severity: "warning", description: "`###` change type has no entries — delete empty sections." },
  { rule: "empty-released-version", severity: "warning", description: "Released version has no change sections at all." },
  { rule: "unreleased-link-missing", severity: "warning", description: "No `[unreleased]:` link reference." },
  { rule: "unreleased-link-stale", severity: "warning", description: "`[unreleased]:` compare link does not point at the latest released version ...HEAD." },
  { rule: "unused-link-ref", severity: "warning", description: "Version-shaped link reference has no matching heading." },
  { rule: "commit-log-entry", severity: "warning", description: "Entry reads like a raw commit subject (sha, `Merge …`, `feat:` prefix, Signed-off-by)." },
  { rule: "security-entry-under-fixed", severity: "warning", description: "Vulnerability-sounding entry filed under Fixed instead of Security." },
  { rule: "removal-without-deprecation", severity: "warning", description: "Version has `### Removed` and no `### Deprecated` appears in it or any earlier version." },
  { rule: "change-type-order", severity: "warning", description: "Change types are not in the spec's canonical order." },
  { rule: "version-tag-prefix", severity: "warning", description: "Heading version carries a `v` prefix; use the bare version (tags keep the prefix)." },
  { rule: "yanked-marker-case", severity: "warning", description: "Yanked marker must be the literal uppercase `[YANKED]`." },
  { rule: "date-in-future", severity: "warning", description: "Release date is later than today." },
  { rule: "non-dash-bullet", severity: "warning", description: "Entry uses `*` or `+` instead of the conventional `-` bullet." },
];

function printHelp(): void {
  console.error(`Usage: bun validate.ts [OPTIONS]

Parses a CHANGELOG.md and reports Keep a Changelog 1.1.0 violations as JSON
on stdout. Diagnostics go to stderr. Never modifies the file.

Options:
  --file FILE      Changelog to check (default: ./CHANGELOG.md)
  --format FORMAT  json (default) or text
  --strict         Treat warnings as errors for the exit code
  --list-rules     Print every rule id + severity + description as JSON, then exit 0
  --verbose        Print progress to stderr
  -h, --help       Show this help

Exit codes:
  0  clean — no findings at all
  1  at least one error-severity finding (or any finding under --strict)
  2  usage error — unknown flag, missing value, file not found/unreadable
  3  warning-severity findings only

Examples:
  bun validate.ts --file ./CHANGELOG.md
  bun validate.ts --file ./CHANGELOG.md --format text
  bun validate.ts --file ./CHANGELOG.md --strict
  bun validate.ts --list-rules`);
}

interface Args {
  file: string;
  format: "json" | "text";
  strict: boolean;
  listRules: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    file: "CHANGELOG.md",
    format: "json",
    strict: false,
    listRules: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--file") {
      const v = argv[++i];
      if (v === undefined) { console.error("Error: --file requires a value"); process.exit(2); }
      args.file = v;
    } else if (a === "--format") {
      const v = argv[++i];
      if (v !== "json" && v !== "text") { console.error("Error: --format must be json or text"); process.exit(2); }
      args.format = v;
    } else if (a === "--strict") args.strict = true;
    else if (a === "--list-rules") args.listRules = true;
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
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split(".") : [],
  };
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

function isRealDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= dim;
}

function todayIso(): string {
  const now = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const COMMIT_LOG_PATTERNS: Array<{ re: RegExp; what: string }> = [
  { re: /^[0-9a-f]{7,40}\b/i, what: "starts with a commit sha" },
  { re: /^Merge (pull request|branch|remote-tracking|tag)\b/i, what: "is a merge commit subject" },
  { re: /^(feat|fix|chore|docs|refactor|test|style|perf|build|ci|revert)(\([^)]*\))?!?:\s/i, what: "is a Conventional Commit subject" },
  { re: /^Signed-off-by:/i, what: "is a commit trailer" },
  { re: /^(Revert|Bump|WIP|wip)\b\s*"/, what: "is a raw commit subject" },
  { re: /^\*\s*\w+\s*\(\w+\):/, what: "is a generated commit-log line" },
];

const SECURITY_PATTERN =
  /\b(cve-\d{4}-\d{4,}|vulnerabilit|xss|cross-site scripting|csrf|sql injection|rce|remote code execution|privilege escalation|path traversal|ssrf|arbitrary code|auth(entication|orisation|orization) bypass|sandbox escape|secret leak|credential leak)\b/i;

interface VersionSection {
  line: number;
  id: string;
  version: string | null;
  semver: Semver | null;
  date: string | null;
  isUnreleased: boolean;
  changeTypes: Array<{ name: string; line: number; entries: number }>;
}

function validate(text: string, args: Args): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, line: number, message: string): void => {
    const doc = RULES.find((r) => r.rule === rule);
    findings.push({ rule, severity: doc?.severity ?? "error", line, message });
  };

  if (text.trim() === "") {
    add("file-empty", 1, "Changelog is empty. Start from assets/changelog-template.md.");
    return findings;
  }

  const lines = text.split(/\r?\n/);
  const linkRefs = new Map<string, { line: number; url: string }>();
  const sections: VersionSection[] = [];

  let h1Line = -1;
  let firstH2Line = -1;
  let inFence = false;
  let current: VersionSection | null = null;
  let currentType: { name: string; line: number; entries: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const lineNo = i + 1;

    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;

    const refMatch = /^\[([^\]]+)\]:\s*(\S+)/.exec(raw);
    if (refMatch && refMatch[1] !== undefined && refMatch[2] !== undefined) {
      linkRefs.set(refMatch[1].toLowerCase(), { line: lineNo, url: refMatch[2] });
      continue;
    }

    if (/^#\s+/.test(raw)) { if (h1Line === -1) h1Line = lineNo; continue; }

    const h2 = /^##\s+(.+?)\s*$/.exec(raw);
    if (h2 && h2[1] !== undefined) {
      if (firstH2Line === -1) firstH2Line = lineNo;
      current = parseVersionHeading(h2[1], lineNo, add);
      sections.push(current);
      currentType = null;
      continue;
    }

    const h3 = /^###\s+(.+?)\s*$/.exec(raw);
    if (h3 && h3[1] !== undefined) {
      const name = h3[1];
      if (!current) {
        add("entry-outside-change-type", lineNo, `Change type "${name}" appears before any version heading.`);
        continue;
      }
      const canonical = CHANGE_TYPES.find((t) => t.toLowerCase() === name.toLowerCase());
      if (!canonical) {
        add("unknown-change-type", lineNo, `"${name}" is not a Keep a Changelog type. Use one of: ${CHANGE_TYPES.join(", ")}.`);
      } else if (canonical !== name) {
        add("unknown-change-type", lineNo, `"${name}" must be spelled exactly "${canonical}".`);
      }
      const key = canonical ?? name;
      if (current.changeTypes.some((c) => c.name === key)) {
        add("duplicate-change-type", lineNo, `"${key}" already appears in this version — merge the two sections.`);
      }
      currentType = { name: key, line: lineNo, entries: 0 };
      current.changeTypes.push(currentType);
      continue;
    }

    const bullet = /^\s{0,3}([-*+])\s+(.+?)\s*$/.exec(raw);
    if (bullet && bullet[1] !== undefined && bullet[2] !== undefined) {
      const marker = bullet[1];
      const entry = bullet[2];
      if (!current) continue; // bullets in the intro are prose, not entries
      if (!currentType) {
        add("entry-outside-change-type", lineNo, `Entry "${truncate(entry)}" has no "### <type>" heading above it inside ${current.id}.`);
        continue;
      }
      currentType.entries++;
      if (marker !== "-") {
        add("non-dash-bullet", lineNo, `Entry uses "${marker}"; Keep a Changelog examples use "-".`);
      }
      for (const p of COMMIT_LOG_PATTERNS) {
        if (p.re.test(entry)) {
          add("commit-log-entry", lineNo, `Entry ${p.what}: "${truncate(entry)}". Changelogs are for humans — describe the user-visible change, not the commit.`);
          break;
        }
      }
      if (currentType.name === "Fixed" && SECURITY_PATTERN.test(entry)) {
        add("security-entry-under-fixed", lineNo, `"${truncate(entry)}" looks like a vulnerability fix — it belongs under "### Security".`);
      }
    }
  }

  if (h1Line === -1) {
    add("missing-h1", 1, "Add a `# Changelog` heading at the top of the file.");
  }

  // Intro notice check: text between the H1 and the first version heading.
  const introEnd = firstH2Line === -1 ? lines.length : firstH2Line - 1;
  const introStart = h1Line === -1 ? 0 : h1Line;
  const intro = lines.slice(introStart, introEnd).join("\n").toLowerCase();
  if (!intro.includes("keepachangelog") && !intro.includes("keep a changelog")) {
    add("missing-intro-notice", Math.max(h1Line, 1), "Intro should link the format: \"The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)\".");
  } else if (!intro.includes("semantic versioning") && !intro.includes("semver")) {
    add("missing-intro-notice", Math.max(h1Line, 1), "Intro should state whether the project adheres to Semantic Versioning (guiding principle #7).");
  }

  const unreleasedIdx = sections.findIndex((s) => s.isUnreleased);
  if (unreleasedIdx === -1) {
    add("missing-unreleased", firstH2Line === -1 ? 1 : firstH2Line, "Keep an `## [Unreleased]` section at the top to gather upcoming changes.");
  } else if (unreleasedIdx !== 0) {
    const s = sections[unreleasedIdx];
    add("unreleased-not-first", s?.line ?? 1, "`## [Unreleased]` must be the first version section (latest first).");
  }

  const released = sections.filter((s) => !s.isUnreleased);
  const today = todayIso();
  const seen = new Map<string, number>();

  for (const s of released) {
    if (s.version !== null) {
      const prior = seen.get(s.version);
      if (prior !== undefined) {
        add("duplicate-version", s.line, `Version ${s.version} already declared at line ${prior}.`);
      } else {
        seen.set(s.version, s.line);
      }
    }
    if (s.date !== null && s.date > today) {
      add("date-in-future", s.line, `Release date ${s.date} is in the future (today is ${today}). The date is the release date, not the authoring date.`);
    }
    if (s.changeTypes.length === 0) {
      add("empty-released-version", s.line, `${s.id} lists no changes. Every released version needs at least one change type.`);
    }
    for (const c of s.changeTypes) {
      if (c.entries === 0) {
        add("empty-change-section", c.line, `"### ${c.name}" in ${s.id} has no entries — remove empty sections, they are noise.`);
      }
    }
    const order = s.changeTypes
      .map((c) => CHANGE_TYPES.indexOf(c.name as (typeof CHANGE_TYPES)[number]))
      .filter((n) => n >= 0);
    for (let i = 1; i < order.length; i++) {
      const prev = order[i - 1];
      const cur = order[i];
      if (prev !== undefined && cur !== undefined && cur < prev) {
        add("change-type-order", s.changeTypes[i]?.line ?? s.line, `Change types in ${s.id} are out of canonical order (${CHANGE_TYPES.join(" → ")}). Consistent order is what makes a changelog scannable.`);
        break;
      }
    }
  }

  // Unreleased may also carry empty sections.
  const unreleased = unreleasedIdx === -1 ? null : sections[unreleasedIdx];
  if (unreleased) {
    for (const c of unreleased.changeTypes) {
      if (c.entries === 0) {
        add("empty-change-section", c.line, `"### ${c.name}" in [Unreleased] has no entries — remove it until there is something to list.`);
      }
    }
  }

  // Descending order + deprecation lifecycle.
  for (let i = 1; i < released.length; i++) {
    const a = released[i - 1];
    const b = released[i];
    if (!a || !b) continue;
    if (a.semver && b.semver && compareSemver(a.semver, b.semver) < 0) {
      add("versions-out-of-order", b.line, `${b.version} is listed after ${a.version}; the latest version comes first.`);
    } else if (a.date && b.date && a.date < b.date) {
      add("versions-out-of-order", b.line, `${b.id} (${b.date}) is dated later than ${a.id} (${a.date}) above it.`);
    }
  }

  const anyDeprecated = sections.some((s) => s.changeTypes.some((c) => c.name === "Deprecated"));
  if (!anyDeprecated) {
    const firstRemoval = sections.find((s) => s.changeTypes.some((c) => c.name === "Removed"));
    if (firstRemoval) {
      add("removal-without-deprecation", firstRemoval.line, `This changelog has "### Removed" sections but no "### Deprecated" anywhere. Users must be able to upgrade to a version that lists a deprecation, remove what is deprecated, then upgrade to the version where it becomes a removal. Reported once for the whole file (first at ${firstRemoval.id}).`);
    }
  }

  // Link references.
  const headingIds = new Set<string>();
  for (const s of sections) {
    headingIds.add(s.id.toLowerCase());
    if (!linkRefs.has(s.id.toLowerCase())) {
      if (s.isUnreleased) {
        add("unreleased-link-missing", s.line, "No `[unreleased]:` link reference at the bottom of the file — versions and sections should be linkable.");
      } else {
        add("missing-link-ref", s.line, `No \`[${s.id}]: <url>\` link reference at the bottom of the file.`);
      }
    }
  }
  for (const [id, ref] of linkRefs) {
    if (headingIds.has(id)) continue;
    if (/^v?\d+\.\d+/.test(id) || id === "unreleased") {
      add("unused-link-ref", ref.line, `Link reference [${id}] has no matching version heading.`);
    }
  }

  const unreleasedRef = linkRefs.get("unreleased");
  const latest = released[0];
  if (unreleasedRef && latest?.version) {
    const url = unreleasedRef.url;
    if (!/(\.\.\.|%2E%2E%2E)HEAD\b/i.test(url) && !/\/HEAD$/i.test(url)) {
      add("unreleased-link-stale", unreleasedRef.line, `[unreleased] should compare the latest release to HEAD (…/compare/<tag>...HEAD); got "${url}".`);
    } else if (!url.includes(latest.version)) {
      add("unreleased-link-stale", unreleasedRef.line, `[unreleased] compares against something other than the latest release ${latest.version}: "${url}". Update this on every release or it silently points at the wrong diff.`);
    }
  }

  findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  if (args.verbose) console.error(`Parsed ${sections.length} version section(s), ${linkRefs.size} link reference(s).`);
  return findings;
}

function truncate(s: string): string {
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

function parseVersionHeading(
  headingText: string,
  lineNo: number,
  add: (rule: string, line: number, message: string) => void,
): VersionSection {
  const section: VersionSection = {
    line: lineNo,
    id: headingText,
    version: null,
    semver: null,
    date: null,
    isUnreleased: false,
    changeTypes: [],
  };

  let rest = headingText;
  const linked = /^\[([^\]]+)\]\s*(.*)$/.exec(headingText);
  let id: string;
  if (linked && linked[1] !== undefined) {
    id = linked[1];
    rest = linked[2] ?? "";
  } else {
    const first = /^(\S+)\s*(.*)$/.exec(headingText);
    id = first?.[1] ?? headingText;
    rest = first?.[2] ?? "";
    add("unlinked-version-heading", lineNo, `Wrap the version in brackets so it is linkable: "## [${id}]${rest ? ` ${rest}` : ""}".`);
  }
  section.id = id;

  if (/^unreleased$/i.test(id)) {
    section.isUnreleased = true;
    if (rest.trim() !== "") {
      add("malformed-version-heading", lineNo, `[Unreleased] must not carry a date; got "${rest.trim()}".`);
    }
    return section;
  }

  // Strip a yanked marker off the tail before date parsing.
  const yanked = /\s*\[\s*(yanked)\s*\]\s*$/i.exec(rest);
  if (yanked) {
    rest = rest.slice(0, yanked.index);
    if (yanked[1] !== "YANKED") {
      add("yanked-marker-case", lineNo, `Yanked marker must be the literal uppercase "[YANKED]"; got "[${yanked[1]}]".`);
    }
  }

  let versionText = id;
  if (/^v\d/.test(versionText)) {
    add("version-tag-prefix", lineNo, `Heading version "${versionText}" carries a "v" prefix; use the bare version in the heading and keep "v" for the git tag.`);
    versionText = versionText.slice(1);
  }
  section.version = versionText;
  const sv = parseSemver(versionText);
  if (!sv) {
    add("invalid-semver", lineNo, `"${id}" is not a valid Semantic Version (MAJOR.MINOR.PATCH).`);
  } else {
    section.semver = sv;
  }

  const tail = rest.trim();
  if (tail === "") {
    add("missing-date", lineNo, `[${id}] has no release date. Released versions display their release date: "## [${id}] - YYYY-MM-DD".`);
    return section;
  }

  const dateMatch = /^([-–—])\s*(.+)$/.exec(tail);
  if (!dateMatch || dateMatch[2] === undefined) {
    add("malformed-version-heading", lineNo, `Expected "## [${id}] - YYYY-MM-DD"; got "## ${headingText}".`);
    return section;
  }
  if (dateMatch[1] !== "-") {
    add("malformed-version-heading", lineNo, `Separate version and date with a plain hyphen "-", not "${dateMatch[1]}".`);
  }
  const dateText = dateMatch[2].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    add("invalid-date-format", lineNo, `Date "${dateText}" is not ISO 8601 YYYY-MM-DD. Regional formats are ambiguous; ISO 8601 orders largest unit to smallest and is the spec's recommendation.`);
  } else if (!isRealDate(dateText)) {
    add("invalid-date-value", lineNo, `Date "${dateText}" is not a real calendar date.`);
  } else {
    section.date = dateText;
  }
  return section;
}

const args = parseArgs(Bun.argv.slice(2));

if (args.listRules) {
  console.log(JSON.stringify({ spec: "1.1.0", rules: RULES }, null, 2));
  process.exit(0);
}

const file = Bun.file(args.file);
if (!(await file.exists())) {
  console.error(`Error: file not found: ${args.file}`);
  process.exit(2);
}

let text: string;
try {
  text = await file.text();
} catch (err) {
  console.error(`Error: cannot read ${args.file}: ${String(err)}`);
  process.exit(2);
}

const findings = validate(text, args);
const errors = findings.filter((f) => f.severity === "error");
const warnings = findings.filter((f) => f.severity === "warning");

if (args.format === "text") {
  for (const f of findings) {
    console.log(`${args.file}:${f.line}: ${f.severity}: [${f.rule}] ${f.message}`);
  }
  console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
} else {
  console.log(
    JSON.stringify(
      {
        file: args.file,
        spec: "keepachangelog-1.1.0",
        valid: errors.length === 0 && (!args.strict || warnings.length === 0),
        errorCount: errors.length,
        warningCount: warnings.length,
        findings,
      },
      null,
      2,
    ),
  );
}

if (errors.length > 0 || (args.strict && warnings.length > 0)) process.exit(1);
if (warnings.length > 0) process.exit(3);
process.exit(0);
