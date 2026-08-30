import { expect, test } from "bun:test";
import type { ErasureProof } from "@custodian/primitives";
import { admissibleProof } from "@custodian/custody";

function proof(attestation: ErasureProof["attestation"]): ErasureProof {
  return {
    target: "s_01jd7k9h2m4n6p8r0s2t4v6x8z",
    destroyedAt: "2026-08-30T00:00:00.000Z",
    keyReference: "kms:key/abc",
    recordId: "8f14e45f-ea6a-4f2b-9f6b-2d8f1f2f0a11",
    attestation,
  };
}

test("an externally attested proof is admissible", () => {
  const admitted = admissibleProof(proof("external"));
  expect(admitted.ok).toBe(true);
});

test("a self-attested proof is not evidence, and says so", () => {
  // The erasing party wrote the record of its own erasure. That may be true and is not evidence:
  // the artefact the spec asks for is independently verifiable.
  const rejected = admissibleProof(proof("self"));
  expect(rejected).toEqual({
    ok: false,
    error: { kind: "self-attested", target: "s_01jd7k9h2m4n6p8r0s2t4v6x8z" },
  });
});
