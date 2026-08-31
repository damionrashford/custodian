/**
 * Report pass^k, not pass@k. pass@k asks whether *any* of k attempts succeeded — a generous metric
 * that flatters. pass^k asks whether *all* k succeeded, which is the question production actually
 * poses, because in deployment the agent runs once
 * (test-and-security-assurance.txt:30).
 *
 * The collapse is not theoretical: one evaluated agent fell from pass₁ = 29.6% to pass₅ = 8.0%, and
 * the failures were silent — no tool error marked a violating run.
 */
export type TaskRuns = {
  readonly task: string;
  /** One boolean per repeated trial of the same task. */
  readonly outcomes: readonly boolean[];
};

export type ConsistencyReport = {
  readonly k: number;
  /** Fraction of tasks where every trial succeeded. Gate on this. */
  readonly passCaret: number;
  /** Fraction where at least one trial succeeded. Publish if useful; never gate on it. */
  readonly passAt: number;
  readonly taskCount: number;
};

export type EvalRejection =
  | { readonly kind: "no-tasks" }
  | {
      readonly kind: "uneven-trials";
      readonly task: string;
      readonly expected: number;
      readonly found: number;
    }
  | { readonly kind: "single-trial"; readonly task: string };

/**
 * A single passing run is weak evidence that the agent complies with policy, so a report built from
 * one trial per task is refused rather than silently reported as pass^1 — which would read as a
 * consistency measurement while measuring nothing of the kind.
 */
export function measureConsistency(
  tasks: readonly TaskRuns[],
):
  | { readonly ok: true; readonly value: ConsistencyReport }
  | { readonly ok: false; readonly error: EvalRejection } {
  const first = tasks[0];
  if (first === undefined) {
    return { ok: false, error: { kind: "no-tasks" } };
  }

  const k = first.outcomes.length;
  if (k < 2) {
    return { ok: false, error: { kind: "single-trial", task: first.task } };
  }

  for (const task of tasks) {
    if (task.outcomes.length !== k) {
      return {
        ok: false,
        error: { kind: "uneven-trials", task: task.task, expected: k, found: task.outcomes.length },
      };
    }
  }

  const allPassed = tasks.filter((task) => task.outcomes.every(Boolean)).length;
  const anyPassed = tasks.filter((task) => task.outcomes.some(Boolean)).length;

  return {
    ok: true,
    value: {
      k,
      passCaret: allPassed / tasks.length,
      passAt: anyPassed / tasks.length,
      taskCount: tasks.length,
    },
  };
}

export type GateVerdict =
  | { readonly kind: "pass" }
  | { readonly kind: "fail"; readonly passCaret: number; readonly threshold: number };

/**
 * The gate reads pass^k and nothing else. Taking `passAt` here would make the report's generous
 * number the one that decides a release, which is the failure this whole distinction exists to
 * prevent.
 */
export function gateOnConsistency(report: ConsistencyReport, threshold: number): GateVerdict {
  return report.passCaret >= threshold
    ? { kind: "pass" }
    : { kind: "fail", passCaret: report.passCaret, threshold };
}
