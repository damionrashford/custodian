import { expect, test } from "bun:test";
import { verifyAgentCard, type AgentCard } from "@custodian/identity";

const CARD: AgentCard = {
  id: "card_retrieval_agent",
  issuedAt: "2026-08-29T12:00:00.000Z",
  nonce: "n_01jd7k9h2m4n6p8r",
  signature: "sig_valid",
};

const deps = {
  verifier: { isValid: (card: AgentCard) => card.signature === "sig_valid" },
  nonces: { hasSeen: (nonce: string) => nonce === "n_replayed" },
  now: new Date("2026-08-29T12:02:00.000Z"),
};

test("a fresh, correctly signed, unseen card is accepted", () => {
  expect(verifyAgentCard(CARD, deps)).toEqual({ ok: true, value: CARD });
});

test("an invalid signature is rejected", () => {
  expect(verifyAgentCard({ ...CARD, signature: "sig_forged" }, deps)).toEqual({
    ok: false,
    error: { kind: "signature-invalid" },
  });
});

test("a card older than the freshness window is rejected", () => {
  const stale = { ...CARD, issuedAt: "2026-08-29T11:50:00.000Z" };
  expect(verifyAgentCard(stale, deps)).toEqual({
    ok: false,
    error: { kind: "outside-freshness-window", issuedAt: "2026-08-29T11:50:00.000Z" },
  });
});

test("a replayed nonce is rejected even when the signature and timestamp are good", () => {
  expect(verifyAgentCard({ ...CARD, nonce: "n_replayed" }, deps)).toEqual({
    ok: false,
    error: { kind: "nonce-replayed", nonce: "n_replayed" },
  });
});
