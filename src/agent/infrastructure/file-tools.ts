import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { err, isRecord, ok, type Result, type ToolName } from "@custodian/primitives";
import { safePath, type PathRejection } from "../domain/workspace-path";
import type { Tool, ToolFailure, ToolObservation } from "../domain/tool";

/** A file the model reads is content it did not write; the cap keeps one from filling the context. */
const MAX_READ_BYTES = 64 * 1024;
/** A model that wants to write more than this is doing something the tool was not built for. */
const MAX_WRITE_BYTES = 256 * 1024;

export type WorkspaceOptions = {
  readonly name: ToolName;
  /** Absolute path the workspace is rooted at. Nothing outside it is reachable. */
  readonly root: string;
};

/**
 * Reads a file from the agent's workspace.
 *
 * `sensitive-data-access` rather than `low-risk-reversible`: reading is reversible, but the class
 * is about what the action touches, not whether it can be undone, and this reaches whatever the
 * workspace holds.
 */
export class ReadFileTool implements Tool {
  readonly name: ToolName;
  readonly actionClass = "sensitive-data-access" as const;
  readonly #root: string;

  constructor(options: WorkspaceOptions) {
    this.name = options.name;
    this.#root = options.root;
  }

  async execute(argumentsJson: string): Promise<Result<ToolObservation, ToolFailure>> {
    const parsed = parsePath(argumentsJson);
    if (!parsed.ok) {
      return err(parsed.error);
    }
    const resolved = safePath(this.#root, parsed.value.path);
    if (!resolved.ok) {
      return err(rejected(resolved.error));
    }

    const file = Bun.file(resolved.value);
    if (!(await file.exists())) {
      return ok({
        kind: "acted",
        receipt: { summary: `No file at ${parsed.value.path}.`, output: "" },
      });
    }

    // `size` is available without reading (/runtime/file-io), and `slice` bounds the read itself
    // rather than reading everything and trimming afterwards — the difference matters when the
    // thing on disk is larger than this process's memory.
    const bounded = file.slice(0, MAX_READ_BYTES);
    const text = await bounded.text();
    const truncated = file.size > MAX_READ_BYTES;

    return ok({
      kind: "acted",
      receipt: {
        summary: truncated
          ? `Read the first ${String(MAX_READ_BYTES)} bytes of ${parsed.value.path}, which is larger.`
          : `Read ${parsed.value.path}.`,
        // Untrusted: the agent may have written this file from a web fetch, so its own earlier
        // output comes back as content someone else authored. The runtime rails it.
        output: text,
      },
    });
  }
}

/**
 * Writes a file into the agent's workspace.
 *
 * `financial-or-irreversible`, because a write destroys whatever was there. That routes it to the
 * high-assurance review lane, which is the point: the model does not get to grade its own action.
 */
export class WriteFileTool implements Tool {
  readonly name: ToolName;
  readonly actionClass = "financial-or-irreversible" as const;
  readonly #root: string;

  constructor(options: WorkspaceOptions) {
    this.name = options.name;
    this.#root = options.root;
  }

  async execute(argumentsJson: string): Promise<Result<ToolObservation, ToolFailure>> {
    const parsed = parseWrite(argumentsJson);
    if (!parsed.ok) {
      return err(parsed.error);
    }
    const resolved = safePath(this.#root, parsed.value.path);
    if (!resolved.ok) {
      return err(rejected(resolved.error));
    }
    if (parsed.value.contents.length > MAX_WRITE_BYTES) {
      return err({
        kind: "invalid-arguments",
        reason: `contents exceed ${String(MAX_WRITE_BYTES)} bytes`,
      });
    }

    // The parent directory is created inside the workspace only — `resolved` already proved the
    // path cannot climb out, so this cannot mkdir its way somewhere else.
    await mkdir(dirname(resolved.value), { recursive: true });
    const written = await Bun.write(resolved.value, parsed.value.contents);

    return ok({
      kind: "acted",
      receipt: {
        summary: `Wrote ${String(written)} bytes to ${parsed.value.path}.`,
        // Nothing is echoed back. Returning the content the model just supplied would spend context
        // restating what it already knows, and would launder model text through a tool result.
        output: "",
      },
    });
  }
}

function rejected(rejection: PathRejection): ToolFailure {
  return { kind: "invalid-arguments", reason: rejection.kind };
}

function parsePath(argumentsJson: string): Result<{ readonly path: string }, ToolFailure> {
  const parsed = parseObject(argumentsJson);
  if (!parsed.ok) {
    return err(parsed.error);
  }
  const path = parsed.value["path"];
  return typeof path === "string"
    ? ok({ path })
    : err({ kind: "invalid-arguments", reason: "path must be a string" });
}

function parseWrite(
  argumentsJson: string,
): Result<{ readonly path: string; readonly contents: string }, ToolFailure> {
  const parsed = parseObject(argumentsJson);
  if (!parsed.ok) {
    return err(parsed.error);
  }
  const path = parsed.value["path"];
  const contents = parsed.value["contents"];
  if (typeof path !== "string") {
    return err({ kind: "invalid-arguments", reason: "path must be a string" });
  }
  return typeof contents === "string"
    ? ok({ path, contents })
    : err({ kind: "invalid-arguments", reason: "contents must be a string" });
}

/** Model arguments are untrusted input and cross a parser once. */
function parseObject(argumentsJson: string): Result<Record<string, unknown>, ToolFailure> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson);
  } catch {
    return err({ kind: "invalid-arguments", reason: "arguments were not JSON" });
  }
  return isRecord(parsed)
    ? ok(parsed)
    : err({ kind: "invalid-arguments", reason: "arguments were not an object" });
}
