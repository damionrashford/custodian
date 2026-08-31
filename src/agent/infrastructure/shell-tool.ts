import { err, isRecord, ok, type Result, type ToolName } from "@custodian/primitives";
import {
  DEFAULT_EXECUTION_LIMITS,
  type CodeExecutor,
  type ExecutionLimits,
  type Runtime,
} from "../domain/code-executor";
import type { Tool, ToolFailure, ToolObservation } from "../domain/tool";

/**
 * Lets the agent run a shell command, or a short program, in the sandbox.
 *
 * Its action class is `financial-or-irreversible`, which is the highest the platform has, and that
 * is not pessimism: a shell can delete, spend, and reach whatever the sandbox can reach, and the
 * class is what routes it to the high-assurance review lane. Naming it anything softer would be the
 * model deciding its own blast radius by proxy.
 *
 * The tool does not see the tenant's namespace beyond receiving it, and the sandbox has no network
 * and no writable filesystem outside a small tmpfs — so a command cannot reach tenant data even
 * though the agent invoking it is inside a tenant's run.
 */
export class ShellTool implements Tool {
  readonly name: ToolName;
  readonly actionClass = "financial-or-irreversible" as const;
  readonly #executor: CodeExecutor;
  readonly #limits: ExecutionLimits;

  constructor(options: {
    readonly name: ToolName;
    readonly executor: CodeExecutor;
    readonly limits?: ExecutionLimits;
  }) {
    this.name = options.name;
    this.#executor = options.executor;
    this.#limits = options.limits ?? DEFAULT_EXECUTION_LIMITS;
  }

  /**
   * Takes no namespace, which the port permits and which says something true: every other tool
   * scopes its reads by one, and this has nothing to scope. The sandbox has no network and no
   * writable filesystem beyond a tmpfs, so a command cannot reach tenant data whatever run it
   * belongs to — isolation here is the absence of a path, not a filter applied to one.
   */
  async execute(argumentsJson: string): Promise<Result<ToolObservation, ToolFailure>> {
    const parsed = parseArguments(argumentsJson);
    if (!parsed.ok) {
      return err(parsed.error);
    }

    const outcome = await this.#executor.execute({
      runtime: parsed.value.runtime,
      source: parsed.value.source,
      limits: this.#limits,
    });
    if (!outcome.ok) {
      // The limit that fired is the useful half. "The tool failed" would send the model round again
      // with the same program, and a timeout is not a transient fault to retry into.
      return err({ kind: "execution-failed", reason: outcome.error.kind });
    }

    return ok({
      kind: "acted",
      receipt: {
        // Platform-authored, so it is safe in the prompt verbatim.
        summary: `${parsed.value.runtime} exited ${String(outcome.value.exitCode)}`,
        // The program's own bytes. Railed by the runtime before any of it reaches the model.
        output: [outcome.value.stdout, outcome.value.stderr]
          .filter((part) => part.length > 0)
          .join("\n"),
        // A program ran. What it did inside the sandbox is not knowable from here, so the honest
        // record is that it ran and under which runtime — the log's job is to say a side effect
        // happened, not to invent an inventory of one.
        committed: [`ran a ${parsed.value.runtime} program in the sandbox`],
      },
    });
  }
}

const RUNTIMES: ReadonlySet<string> = new Set<Runtime>(["bash", "python", "node"]);

/** The model's arguments are untrusted input and cross a parser once, here. */
function parseArguments(
  argumentsJson: string,
): Result<{ readonly runtime: Runtime; readonly source: string }, ToolFailure> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson);
  } catch {
    return err({ kind: "invalid-arguments", reason: "arguments were not JSON" });
  }
  if (!isRecord(parsed)) {
    return err({ kind: "invalid-arguments", reason: "arguments were not an object" });
  }

  const runtime = parsed["runtime"] ?? "bash";
  const source = parsed["source"];
  if (typeof runtime !== "string" || !RUNTIMES.has(runtime)) {
    return err({ kind: "invalid-arguments", reason: "runtime must be bash, python or node" });
  }
  if (typeof source !== "string" || source.length === 0) {
    return err({ kind: "invalid-arguments", reason: "source must be a non-empty string" });
  }
  // Narrowed by the set membership above; the cast-free path is to re-derive it.
  const chosen: Runtime = runtime === "python" ? "python" : runtime === "node" ? "node" : "bash";
  return ok({ runtime: chosen, source });
}
