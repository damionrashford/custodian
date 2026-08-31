import type { Result } from "@custodian/primitives";

/**
 * What the agent may execute. A closed union rather than a free-form interpreter name, so a model
 * cannot name a runtime the image does not have and cannot smuggle flags through the field.
 */
export type Runtime = "bash" | "python" | "node";

/**
 * Limits every execution runs under. There is no "unlimited" — the type has no way to express it,
 * because the failure being prevented is a model-authored loop consuming a host until something
 * else falls over (test-and-security-assurance.txt:92-95).
 */
export type ExecutionLimits = {
  readonly timeoutMs: number;
  readonly memoryMb: number;
  readonly cpus: number;
  /** Process ceiling. Without it a fork bomb is three characters of shell. */
  readonly maxProcesses: number;
  /**
   * Hosts the sandbox may reach. Empty means no network at all, which is the default and the only
   * value that needs no justification: "network egress from the sandbox is deny-by-default with an
   * allowlist, tested adversarially" (test-and-security-assurance.txt:95).
   */
  readonly egressAllowlist: readonly string[];
};

/**
 * Deliberately austere. A generous default is the one an operator never revisits, and every number
 * here is a blast radius rather than a convenience.
 */
export const DEFAULT_EXECUTION_LIMITS: ExecutionLimits = {
  timeoutMs: 10_000,
  memoryMb: 256,
  cpus: 1,
  maxProcesses: 64,
  egressAllowlist: [],
};

export type ExecutionRequest = {
  readonly runtime: Runtime;
  readonly source: string;
  readonly limits: ExecutionLimits;
};

export type ExecutionOutcome = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  /** True when the limits stopped it rather than the program finishing on its own. */
  readonly truncated: boolean;
};

export type ExecutionFailure =
  | { readonly kind: "timed-out"; readonly afterMs: number }
  | { readonly kind: "sandbox-unavailable"; readonly detail: string }
  | { readonly kind: "output-too-large"; readonly bytes: number };

/**
 * Runs untrusted code away from the host.
 *
 * "Untrusted" is not a judgement about the user — it is the standing assumption about anything a
 * model authored. Microsoft disclosed CVEs in May 2026 where prompt injection through an agent
 * framework reached host-level remote code execution
 * (implementation-plan.txt:199), so the threat model here is a hostile author with a
 * foothold, not a careless one.
 */
export interface CodeExecutor {
  execute(request: ExecutionRequest): Promise<Result<ExecutionOutcome, ExecutionFailure>>;
  /**
   * How strongly this implementation isolates. The composition root refuses a `shared-kernel`
   * executor outside development, so the weaker one cannot reach production by being the only one
   * wired up.
   */
  readonly isolation: "microvm" | "shared-kernel";
}

export type SandboxDecision =
  { readonly kind: "compose" } | { readonly kind: "refuse"; readonly reason: string };

/**
 * Whether an executor may be composed.
 *
 * A shared-kernel container is not defensible for untrusted agent code under SOC 2 or HIPAA
 * (implementation-plan.txt:184, :198). The container-backed executor exists so the
 * capability can be built and tested before a Linux host with KVM is available; this is the control
 * that stops it shipping. It is the same shape as the key-custody refusal: the weaker component is
 * usable, visible, and cannot be reached in production by omission.
 */
export function sandboxDecision(settings: {
  readonly isolation: CodeExecutor["isolation"];
  readonly devMode: string | undefined;
}): SandboxDecision {
  if (settings.isolation === "microvm") {
    return { kind: "compose" };
  }
  return settings.devMode === "1"
    ? { kind: "compose" }
    : {
        kind: "refuse",
        reason:
          "A shared-kernel sandbox is not defensible for untrusted agent code. Supply a microVM " +
          "executor, or set CUSTODIAN_DEV_MODE=1 to acknowledge a development-only sandbox.",
      };
}
