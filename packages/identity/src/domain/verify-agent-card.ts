import { err, ok, type Result } from "@custodian/domain-primitives";
import type { AgentCard, CardRejection, NonceLedger, SignatureVerifier } from "./agent-card";

/**
 * Five minutes, matching the webhook signature window in AI_Agent_Implementation_Plan_v2.txt:203.
 * One replay window across the platform is one number to reason about during an incident.
 */
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

export type CardVerificationDeps = {
  readonly verifier: SignatureVerifier;
  readonly nonces: NonceLedger;
  readonly now: Date;
};

export function verifyAgentCard(
  card: AgentCard,
  deps: CardVerificationDeps,
): Result<AgentCard, CardRejection> {
  if (!deps.verifier.isValid(card)) {
    return err({ kind: "signature-invalid" });
  }

  const age = deps.now.getTime() - Date.parse(card.issuedAt);
  if (Number.isNaN(age) || age < 0 || age > FRESHNESS_WINDOW_MS) {
    return err({ kind: "outside-freshness-window", issuedAt: card.issuedAt });
  }

  if (deps.nonces.hasSeen(card.nonce)) {
    return err({ kind: "nonce-replayed", nonce: card.nonce });
  }

  return ok(card);
}
