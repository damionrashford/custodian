/**
 * The workable production pattern is layered: a fast first-pass injection classifier, operating in
 * tens of milliseconds, in front of a heavier hazard classifier
 * (implementation-plan.txt:228). Order is not cosmetic — running the expensive
 * classifier on traffic the cheap one already rejected is the cost mistake the layering exists to
 * avoid.
 *
 * Vendor note carried from the spec: NVIDIA states explicitly that NeMo Guardrails is not
 * recommended for production as-is in its current beta state, which is why `Classifier` is a port
 * rather than a dependency.
 */
export type Stage = "fast-injection" | "hazard";

export const STAGE_ORDER: readonly Stage[] = ["fast-injection", "hazard"];

export type GuardrailVerdict =
  | { readonly kind: "allow" }
  | {
      readonly kind: "block";
      readonly stage: Stage;
      readonly policy: string;
      readonly rule: string;
    };

export interface Classifier {
  readonly stage: Stage;
  readonly policy: string;
  classify(text: string): GuardrailVerdict;
}

/**
 * Short-circuits on the first block, so a heavier classifier never runs on text the cheap one
 * already rejected. Classifiers are evaluated in STAGE_ORDER regardless of the order supplied,
 * because a caller assembling the array in the wrong order would silently invert the cost profile.
 */
export function screen(text: string, classifiers: readonly Classifier[]): GuardrailVerdict {
  for (const stage of STAGE_ORDER) {
    for (const classifier of classifiers.filter((candidate) => candidate.stage === stage)) {
      const verdict = classifier.classify(text);
      if (verdict.kind === "block") {
        return verdict;
      }
    }
  }
  return { kind: "allow" };
}
