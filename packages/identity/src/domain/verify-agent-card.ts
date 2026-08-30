import { err, ok, REPLAY_WINDOW_MS, type Result } from "@custodian/domain-primitives";
import type { AgentCard, CardRejection, NonceLedger, SignatureVerifier } from "./agent-card";

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
  if (Number.isNaN(age) || age < 0 || age > REPLAY_WINDOW_MS) {
    return err({ kind: "outside-freshness-window", issuedAt: card.issuedAt });
  }

  if (deps.nonces.hasSeen(card.nonce)) {
    return err({ kind: "nonce-replayed", nonce: card.nonce });
  }

  return ok(card);
}
