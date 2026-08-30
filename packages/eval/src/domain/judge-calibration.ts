/**
 * An uncalibrated judge produces numbers that feel like measurement. Target a Pearson correlation
 * above 0.7 between judge scores and domain-expert verdicts
 * (Test_and_Security_Assurance.txt:62).
 */
export const MIN_JUDGE_CORRELATION = 0.7;

export type ScoredPair = {
  readonly judge: number;
  readonly expert: number;
};

export type CalibrationVerdict =
  | { readonly kind: "calibrated"; readonly correlation: number }
  | { readonly kind: "uncalibrated"; readonly correlation: number; readonly threshold: number }
  | { readonly kind: "indeterminate"; readonly reason: "no-variance" | "too-few-pairs" };

function pearson(pairs: readonly ScoredPair[]): number | undefined {
  const n = pairs.length;
  const meanJudge = pairs.reduce((sum, p) => sum + p.judge, 0) / n;
  const meanExpert = pairs.reduce((sum, p) => sum + p.expert, 0) / n;

  let covariance = 0;
  let judgeVariance = 0;
  let expertVariance = 0;
  for (const pair of pairs) {
    const dj = pair.judge - meanJudge;
    const de = pair.expert - meanExpert;
    covariance += dj * de;
    judgeVariance += dj * dj;
    expertVariance += de * de;
  }

  const denominator = Math.sqrt(judgeVariance * expertVariance);
  return denominator === 0 ? undefined : covariance / denominator;
}

/**
 * Correlation against expert labels, never agreement rate. Agreement is a trap on imbalanced data:
 * a judge that stamps every output "pass" achieves 90% agreement on a set where 10% should fail, and
 * reports itself as 90% accurate while being useless (Test_and_Security_Assurance.txt:64-65).
 *
 * A judge with no variance in its scores is exactly that judge, and it is reported as indeterminate
 * rather than as a correlation of zero — zero would read as "measured and poor" when the truth is
 * "unmeasurable".
 */
export function calibrate(pairs: readonly ScoredPair[]): CalibrationVerdict {
  if (pairs.length < 2) {
    return { kind: "indeterminate", reason: "too-few-pairs" };
  }
  const correlation = pearson(pairs);
  if (correlation === undefined) {
    return { kind: "indeterminate", reason: "no-variance" };
  }
  return correlation >= MIN_JUDGE_CORRELATION
    ? { kind: "calibrated", correlation }
    : { kind: "uncalibrated", correlation, threshold: MIN_JUDGE_CORRELATION };
}

/**
 * The number a naive dashboard would show. Exported only so a test can demonstrate the trap, and
 * deliberately never consumed by `calibrate`.
 */
export function agreementRate(pairs: readonly ScoredPair[], passAbove: number): number {
  const agreed = pairs.filter((pair) => pair.judge > passAbove === pair.expert > passAbove).length;
  return pairs.length === 0 ? 0 : agreed / pairs.length;
}
