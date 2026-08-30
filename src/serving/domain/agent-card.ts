/**
 * A2A signed Agent Card. The protocol does not mandate how cards are verified for authenticity,
 * which leaves impersonation, tampering and replay as real risks unless the deployment adds
 * controls (AI_Agent_Implementation_Plan_v2.txt:76). The three below are those controls.
 */
export type AgentCard = {
  readonly id: string;
  readonly issuedAt: string;
  readonly nonce: string;
  readonly signature: string;
};

export type CardRejection =
  | { readonly kind: "signature-invalid" }
  | { readonly kind: "outside-freshness-window"; readonly issuedAt: string }
  | { readonly kind: "nonce-replayed"; readonly nonce: string };

export interface SignatureVerifier {
  isValid(card: AgentCard): boolean;
}

export interface NonceLedger {
  hasSeen(nonce: string): boolean;
}
