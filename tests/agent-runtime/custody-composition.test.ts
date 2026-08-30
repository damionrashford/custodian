import { expect, test } from "bun:test";
import { custodyDecision } from "@custodian/agent-runtime";

const ADDRESS = "vault.internal:8200";

test("a fully configured vault composes a durable custodian", () => {
  expect(
    custodyDecision({ vaultAddress: ADDRESS, vaultToken: "s.token", devMode: undefined }),
  ).toEqual({ kind: "vault", address: ADDRESS, token: "s.token" });
});

test("no custodian and no acknowledgement refuses to boot", () => {
  // Durable ciphertext with ephemeral keys is worse than either alone: a restart leaves rows on disk
  // that nothing can decrypt, with no erasure request and no proof that they became unrecoverable.
  expect(
    custodyDecision({ vaultAddress: undefined, vaultToken: undefined, devMode: undefined }),
  ).toEqual({ kind: "refuse" });
});

test("a half-configured vault refuses rather than falling back", () => {
  // The dangerous case, and the reason this is a function rather than a chain of `??`. A deploy that
  // typo'd the token would otherwise boot green, serve traffic, write sealed rows to disk, and
  // silently stop being erasable — with the development acknowledgement providing the fallback.
  expect(custodyDecision({ vaultAddress: ADDRESS, vaultToken: undefined, devMode: "1" })).toEqual({
    kind: "refuse",
  });
  expect(custodyDecision({ vaultAddress: undefined, vaultToken: "s.token", devMode: "1" })).toEqual(
    {
      kind: "refuse",
    },
  );
});

test("an empty token is not a token", () => {
  expect(custodyDecision({ vaultAddress: ADDRESS, vaultToken: "", devMode: "1" })).toEqual({
    kind: "refuse",
  });
});

test("acknowledged development mode composes in-memory keys", () => {
  expect(custodyDecision({ vaultAddress: undefined, vaultToken: undefined, devMode: "1" })).toEqual(
    { kind: "in-memory" },
  );
});
