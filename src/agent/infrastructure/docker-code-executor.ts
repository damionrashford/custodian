import { err, ok, type Result } from "@custodian/primitives";
import type {
  CodeExecutor,
  ExecutionFailure,
  ExecutionLimits,
  ExecutionOutcome,
  ExecutionRequest,
  Runtime,
} from "../domain/code-executor";

/** Output is captured into this process's memory, so the read is bounded rather than the disk. */
const MAX_OUTPUT_BYTES = 256 * 1024;

const INTERPRETER: Readonly<Record<Runtime, readonly string[]>> = {
  bash: ["/bin/sh"],
  python: ["python3"],
  node: ["node"],
};

/**
 * Runs untrusted code in a container.
 *
 * DEVELOPMENT ONLY, and the type says so: `isolation` is `shared-kernel`, and `sandboxDecision`
 * refuses to compose it outside development. The corpus is explicit that shared-kernel containers
 * are not defensible for untrusted agent code under SOC 2 or HIPAA, and that microVM isolation
 * (Firecracker / Kata) is the requirement (AI_Agent_Implementation_Plan_v2.txt:184, :198). This
 * exists so the capability can be built and tested before a Linux host with KVM is available — not
 * because the objection was answered.
 *
 * **Bun offers no isolation primitive, and the near misses are worth naming so nobody "simplifies"
 * this into one.** `Bun.$` is a bash reimplementation that runs *in this same process*; it is
 * injection-safe, which is not the same as isolating, and reaching for it here would put model
 * output in the agent's own address space. `Worker` is a thread sharing the heap. `node:vm` has
 * never been a security boundary. A separate process under OS-level confinement is the only real
 * option, which is why this shells out.
 *
 * Every flag in `isolationFlags` is load-bearing, so none should be dropped as noise:
 *
 * - `--network=none` unless an allowlist is supplied. Deny-by-default egress is the corpus
 *   requirement (Test_and_Security_Assurance.txt:95), and it is the one control that turns an
 *   escape from an exfiltration into a crash.
 * - `--read-only` with a small `noexec` tmpfs: scratch files are fine, altering the image is not,
 *   and nothing dropped into /tmp can then be executed.
 * - `--cap-drop=ALL` and `--security-opt=no-new-privileges`, so a setuid binary is not a ladder.
 * - `--pids-limit`, because a fork bomb is three characters of shell.
 * - `--memory` and `--cpus`, so a model-authored loop cannot take the host with it.
 * - `--user=65534:65534`, so nothing runs as uid 0 even inside the namespace.
 *
 * The source arrives on stdin and the command is an argv array, never an interpolated string.
 * Building a shell command around model output is the injection this component exists to contain.
 */
export class DockerCodeExecutor implements CodeExecutor {
  readonly isolation = "shared-kernel" as const;
  readonly #image: string;

  constructor(options: { readonly image: string }) {
    this.#image = options.image;
  }

  async execute(request: ExecutionRequest): Promise<Result<ExecutionOutcome, ExecutionFailure>> {
    let child: Bun.Subprocess<"pipe", "pipe", "pipe">;
    try {
      child = Bun.spawn({
        cmd: [
          "docker",
          "run",
          "--rm",
          "--interactive",
          ...isolationFlags(request.limits),
          this.#image,
          ...INTERPRETER[request.runtime],
        ],
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        // Bun's own timer, rather than a setTimeout racing `exited`. Verified: the child is killed
        // and `signalCode` reports SIGKILL, so a wedged container cannot hold the loop open.
        timeout: request.limits.timeoutMs,
        // SIGKILL, not the default SIGTERM. Untrusted code must not get a handler's worth of extra
        // life to finish whatever it was doing.
        killSignal: "SIGKILL",
        // A backstop that stops a runaway writer, not the output bound. Measured on Bun.spawn,
        // `maxBuffer` marks the process killed but does not truncate what a later read returns —
        // asking for 200 bytes against a 100 KB writer still yields 100 KB. The docs only claim it
        // for spawnSync, and that turns out to be exact, so `readBounded` below is what actually
        // bounds this process's memory.
        maxBuffer: MAX_OUTPUT_BYTES,
      });
    } catch (cause) {
      return err({ kind: "sandbox-unavailable", detail: String(cause) });
    }

    // FileSink.write reports how much it buffered and may return a promise once the sink fills, so
    // the result is awaited rather than dropped — a large source would otherwise be half-written
    // when end() lands, and the program would run against a truncated file it never asked for.
    await child.stdin.write(request.source);
    await child.stdin.end();

    const exitCode = await child.exited;
    const [stdout, stderr] = await Promise.all([
      readBounded(child.stdout),
      readBounded(child.stderr),
    ]);

    // Truncation is checked before the signal, and the order is load-bearing. Both limits kill with
    // the same SIGKILL, so the signal alone cannot say which fired — reporting "timed out" for a
    // program stopped after 145ms by its own output volume sends whoever reads it looking for a
    // slow program that does not exist. Having overrun the output bound is the more specific fact,
    // so it wins.
    if (stdout.truncated || stderr.truncated) {
      return err({ kind: "output-too-large", bytes: MAX_OUTPUT_BYTES });
    }
    // A killed process and a program that exited on its own are different facts, and the caller
    // acts on the difference: one is a limit doing its job, the other is a result.
    if (child.signalCode === "SIGKILL") {
      return err({ kind: "timed-out", afterMs: request.limits.timeoutMs });
    }
    // Docker reports its own inability to start as 125+, which is not the program's answer and must
    // not be handed back as one.
    if (exitCode >= 125 && stdout.text.length === 0 && stderr.text.includes("docker:")) {
      return err({ kind: "sandbox-unavailable", detail: stderr.text.slice(0, 200) });
    }

    return ok({ exitCode, stdout: stdout.text, stderr: stderr.text, truncated: false });
  }
}

/**
 * Reads at most `MAX_OUTPUT_BYTES` and stops, so a chatty program bounds this process's memory
 * rather than the other way round.
 */
async function readBounded(
  stream: ReadableStream<Uint8Array>,
): Promise<{ readonly text: string; readonly truncated: boolean }> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_OUTPUT_BYTES) {
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total > MAX_OUTPUT_BYTES ? MAX_OUTPUT_BYTES : total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(joined.subarray(0, offset)), truncated };
}

function isolationFlags(limits: ExecutionLimits): readonly string[] {
  return [
    // Deny-by-default. A non-empty allowlist still needs a proxy to enforce per-host rules, so it
    // deliberately does not simply drop this flag and call the job done — a caller supplying hosts
    // is asking for a control this executor does not implement yet, and gets no network either.
    "--network=none",
    "--read-only",
    "--tmpfs=/tmp:rw,noexec,nosuid,size=16m",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    `--pids-limit=${String(limits.maxProcesses)}`,
    `--memory=${String(limits.memoryMb)}m`,
    `--cpus=${String(limits.cpus)}`,
    "--user=65534:65534",
    "--workdir=/tmp",
  ];
}
