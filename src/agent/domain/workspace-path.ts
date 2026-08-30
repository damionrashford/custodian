import { brand, type Brand, err, ok, type Result } from "@custodian/primitives";

/**
 * A path the agent asked for, proven to stay inside its workspace.
 *
 * Branded because the proof is the whole point: a bare string that has been checked and one that has
 * not are indistinguishable at a call site, and the one place that matters is the line just before a
 * file is opened. Built through `brand()` like every other brand here, so the assertion ban holds
 * (LD-11) and there is one place to look for how a proof is minted.
 */
export type SafePath = Brand<string, "SafePath">;

export type PathRejection =
  | { readonly kind: "path-escapes-workspace"; readonly requested: string }
  | { readonly kind: "path-absolute"; readonly requested: string }
  | { readonly kind: "path-empty" }
  | { readonly kind: "path-too-long"; readonly length: number };

/** Long enough for real trees, short enough that a path cannot be a payload. */
const MAX_PATH_LENGTH = 512;

/**
 * Resolves a model-supplied path against the workspace root and refuses anything that leaves it.
 *
 * Traversal is not detected by searching for `..`, which is the version of this that gets bypassed:
 * `a/../../etc/passwd` contains it and is fine after two segments, `%2e%2e` does not contain it and
 * is not. The segments are walked and resolved instead, so the answer is a path that provably never
 * rose above the root — and the result is checked against the root prefix once more, because being
 * right twice for different reasons is cheap here and the cost of being wrong is the filesystem.
 *
 * A resolver from `node:path` would be the obvious alternative and cannot be used: this is a domain
 * file, and domain imports no runtime built-ins. That constraint is doing real work rather than
 * getting in the way — it keeps the rule pure and exhaustively testable with no filesystem at all.
 */
export function safePath(root: string, requested: string): Result<SafePath, PathRejection> {
  const shape = checkShape(requested);
  if (!shape.ok) {
    return err(shape.error);
  }

  const segments: string[] = [];
  for (const raw of requested.split(/[\\/]+/)) {
    const segment = decodeSegment(raw);
    if (segment === "" || segment === ".") {
      continue;
    }
    // A NUL truncates the path at the syscall boundary, so what the checker sees and what the
    // kernel opens would be different strings.
    if (segment.includes("\0")) {
      return err({ kind: "path-escapes-workspace", requested });
    }
    if (segment !== "..") {
      segments.push(segment);
      continue;
    }
    if (segments.length === 0) {
      return err({ kind: "path-escapes-workspace", requested });
    }
    segments.pop();
  }

  if (segments.length === 0) {
    return err({ kind: "path-empty" });
  }

  const base = root.endsWith("/") ? root : `${root}/`;
  const resolved = `${base}${segments.join("/")}`;
  return resolved.startsWith(base)
    ? ok(brand<SafePath>(resolved))
    : err({ kind: "path-escapes-workspace", requested });
}

/**
 * Absolute paths are refused outright rather than silently reinterpreted as relative. A model that
 * asked for `/etc/passwd` and received `<root>/etc/passwd` has been answered misleadingly, and the
 * next thing it does is reason about a file it did not read.
 */
function checkShape(requested: string): Result<null, PathRejection> {
  if (requested.length === 0) {
    return err({ kind: "path-empty" });
  }
  if (requested.length > MAX_PATH_LENGTH) {
    return err({ kind: "path-too-long", length: requested.length });
  }
  return requested.startsWith("/") || /^[A-Za-z]:[\\/]/.test(requested)
    ? err({ kind: "path-absolute", requested })
    : ok(null);
}

/** Decoded before it is judged, so a percent-encoded traversal is read as what it becomes. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
