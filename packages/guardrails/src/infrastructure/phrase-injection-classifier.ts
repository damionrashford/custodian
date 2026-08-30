import type { Classifier, GuardrailVerdict, Stage } from "../domain/screen";

/**
 * The fast first-pass injection classifier the layered pattern calls for
 * (AI_Agent_Implementation_Plan_v2.txt:228) — string matching, tens of microseconds, in front of
 * whatever heavier hazard classifier a deployment adds.
 *
 * It is deliberately shallow: it catches the published phrasings that dominate indirect-injection
 * corpora and nothing else. A deployment that ships only this has a rail, not a defence — but a
 * rail that fires is what separates a screened retrieval path from an unscreened one, and an empty
 * classifier list is a gate that never fires (LD-2).
 */
const INJECTION_PHRASES: readonly string[] = [
  "ignore all previous",
  "ignore previous instructions",
  "disregard the above",
  "disregard all prior",
  "forget your instructions",
  "you are now",
  "new instructions:",
  "system prompt:",
  "reveal your system prompt",
  "print your instructions",
];

export class PhraseInjectionClassifier implements Classifier {
  readonly stage: Stage = "fast-injection";
  readonly policy = "indirect-injection";

  classify(text: string): GuardrailVerdict {
    const lowered = text.toLowerCase();
    for (const phrase of INJECTION_PHRASES) {
      if (lowered.includes(phrase)) {
        return { kind: "block", stage: this.stage, policy: this.policy, rule: phrase };
      }
    }
    return { kind: "allow" };
  }
}
