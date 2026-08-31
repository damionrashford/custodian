import { expect, test } from "bun:test";
import { DEFAULT_EXECUTION_LIMITS, DockerCodeExecutor } from "@custodian/agent";

/**
 * These drive a real container. They are the only way to check that the isolation flags do what
 * they claim — a fake would assert the argv this executor builds, which is the part already known.
 */
const executor = new DockerCodeExecutor({ image: "python:3.13-alpine" });

/**
 * Container startup is not fast and not constant — it varies with machine load, and on a busy host
 * a cold start has taken over five seconds. bun's default per-test timeout is five seconds, so
 * without this these pass and fail by luck, which LD-10 says is worse than not having them: a gate
 * that fires at random teaches people to click through red CI, and takes the credibility of every
 * gate beside it.
 */
const CONTAINER_TIMEOUT_MS = 60_000;

test(
  "it declares itself shared-kernel, which is what gets it refused in production",
  () => {
    expect(executor.isolation).toBe("shared-kernel");
  },
  CONTAINER_TIMEOUT_MS,
);

test(
  "it runs code and returns the program's own answer",
  async () => {
    const outcome = await executor.execute({
      runtime: "python",
      source: "print(6 * 7)",
      limits: DEFAULT_EXECUTION_LIMITS,
    });
    if (!outcome.ok) throw new Error(`execution failed: ${outcome.error.kind}`);
    expect([outcome.value.exitCode, outcome.value.stdout.trim()]).toEqual([0, "42"]);
  },
  CONTAINER_TIMEOUT_MS,
);

test(
  "the sandbox has no network",
  async () => {
    // Deny-by-default egress is the one control that turns an escape into a crash rather than an
    // exfiltration (test-and-security-assurance.txt:95).
    const outcome = await executor.execute({
      runtime: "python",
      source:
        "import socket\ntry:\n socket.create_connection(('1.1.1.1', 80), timeout=3)\n print('REACHED')\nexcept Exception as e:\n print('BLOCKED')",
      limits: DEFAULT_EXECUTION_LIMITS,
    });
    if (!outcome.ok) throw new Error(`execution failed: ${outcome.error.kind}`);
    expect(outcome.value.stdout.trim()).toBe("BLOCKED");
  },
  CONTAINER_TIMEOUT_MS,
);

test(
  "the root filesystem is read-only",
  async () => {
    const outcome = await executor.execute({
      runtime: "python",
      source:
        "try:\n open('/etc/passwd','a').write('x')\n print('WROTE')\nexcept Exception:\n print('READONLY')",
      limits: DEFAULT_EXECUTION_LIMITS,
    });
    if (!outcome.ok) throw new Error(`execution failed: ${outcome.error.kind}`);
    expect(outcome.value.stdout.trim()).toBe("READONLY");
  },
  CONTAINER_TIMEOUT_MS,
);

test(
  "it does not run as root",
  async () => {
    const outcome = await executor.execute({
      runtime: "python",
      source: "import os; print(os.getuid())",
      limits: DEFAULT_EXECUTION_LIMITS,
    });
    if (!outcome.ok) throw new Error(`execution failed: ${outcome.error.kind}`);
    expect(outcome.value.stdout.trim()).not.toBe("0");
  },
  CONTAINER_TIMEOUT_MS,
);

test(
  "a program that will not stop is killed by the timeout",
  async () => {
    const outcome = await executor.execute({
      runtime: "python",
      source: "while True: pass",
      limits: { ...DEFAULT_EXECUTION_LIMITS, timeoutMs: 2_000 },
    });
    expect(outcome.ok ? "finished" : outcome.error.kind).toBe("timed-out");
  },
  CONTAINER_TIMEOUT_MS,
);

test(
  "a program that will not stop talking is cut off",
  async () => {
    // The read is bounded, not the disk: Bun's maxBuffer marks the process killed but still returns
    // everything written, so this process's memory is bounded here or nowhere.
    const outcome = await executor.execute({
      runtime: "python",
      source: "while True: print('x' * 4096)",
      limits: { ...DEFAULT_EXECUTION_LIMITS, timeoutMs: 5_000 },
    });
    expect(outcome.ok ? "finished" : outcome.error.kind).toBe("output-too-large");
  },
  CONTAINER_TIMEOUT_MS,
);
