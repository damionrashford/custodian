import {
  type ErasureProof,
  err,
  type KeyStoreFailure,
  ok,
  type Result,
  type SubjectId,
} from "@custodian/domain-primitives";

/**
 * Every location personal data reaches. Any location not in this map is a defect, logged as such
 * (Data_Protection_and_Retention.txt:92-93) — which is why this is an exhaustive union rather than
 * a list of strings.
 */
export const DATA_MAP = [
  "primary-store",
  "vector-index",
  "response-cache",
  "agent-memory",
  "experience-store",
  "execution-log",
  "idempotency-store",
  "stream-journal",
  "backups",
  "routing-memory",
] as const;

/**
 * Derived from DATA_MAP, never written alongside it. When the two were separate declarations a
 * location could be added to the union and forgotten in the map, which compiles clean and produces
 * an erasure that `missingFrom` then reports as complete — an unprovable erasure that looks proven.
 */
export type ErasureLocation = (typeof DATA_MAP)[number];

export type LegalHold = {
  readonly basis: string;
  readonly recordedAt: string;
};

/**
 * Step 2 of the workflow, as a union rather than a `subject | undefined` plus an
 * `identityAmbiguous: boolean`. Those two independent fields admitted a request that was
 * simultaneously ambiguous and resolved, which the old code silently resolved by checking ambiguity
 * first and discarding the subject — a decision no reader could see and no type prevented.
 */
export type SubjectResolution =
  | { readonly kind: "resolved"; readonly subject: SubjectId }
  | { readonly kind: "ambiguous"; readonly candidates: number }
  | { readonly kind: "unresolved" };

export type ErasureRequest = {
  readonly identity: SubjectResolution;
  readonly receivedAt: string;
  readonly legalHold: LegalHold | undefined;
  readonly coveredLocations: readonly ErasureLocation[];
};

export type ErasureOutcome =
  | {
      readonly kind: "erased";
      readonly subject: SubjectId;
      readonly proof: ErasureProof;
      readonly invalidated: readonly ErasureLocation[];
      /** Art.12(3): one calendar month from receipt. */
      readonly dueBy: string;
    }
  | { readonly kind: "awaiting-human-review"; readonly reason: "identity-ambiguous" }
  | { readonly kind: "blocked"; readonly hold: LegalHold }
  | {
      readonly kind: "data-map-defect";
      readonly missing: readonly ErasureLocation[];
    };

/**
 * The two failures are distinguished because they call for opposite responses: an unresolved
 * identity escalates to human review, while a key-destruction fault is transient infrastructure
 * that the durable workflow should retry. Reporting both as "no-subject-resolved" sent a retryable
 * KMS fault to a human queue and vice versa.
 */
export type ErasureRejection =
  | { readonly kind: "no-subject-resolved" }
  | { readonly kind: "key-destruction-failed"; readonly cause: KeyStoreFailure };

export interface SubjectEraser {
  destroySubjectKey(subject: SubjectId): Promise<Result<ErasureProof, KeyStoreFailure>>;
}

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function missingFrom(covered: readonly ErasureLocation[]): readonly ErasureLocation[] {
  return DATA_MAP.filter((location) => !covered.includes(location));
}

/**
 * The nine steps from Data_Protection_and_Retention.txt:79-108, as a state machine so the ordering
 * and the failure handling are provable without a workflow engine. Only execution is bought (LD-6);
 * the logic is ours.
 *
 * The ordering is load-bearing. Identity resolution precedes the hold check, the hold check precedes
 * the data-map check, and the data-map check precedes key destruction — because destroying a key
 * before confirming the map is complete produces an erasure that cannot be proven complete.
 */
export async function runErasure(
  request: ErasureRequest,
  eraser: SubjectEraser,
): Promise<Result<ErasureOutcome, ErasureRejection>> {
  // Step 2 — ambiguous identity escalates to human review, and does not silently proceed.
  if (request.identity.kind === "ambiguous") {
    return ok({ kind: "awaiting-human-review", reason: "identity-ambiguous" });
  }
  if (request.identity.kind === "unresolved") {
    return err({ kind: "no-subject-resolved" });
  }
  const subject = request.identity.subject;

  // Step 3 — a hold blocks erasure and must be recorded with its basis.
  if (request.legalHold !== undefined) {
    return ok({ kind: "blocked", hold: request.legalHold });
  }

  // Step 4 — enumerate artefacts from the data map. Any location not in the map is a defect.
  const missing = missingFrom(request.coveredLocations);
  if (missing.length > 0) {
    return ok({ kind: "data-map-defect", missing });
  }

  // Step 5 — destroy the DEK. Idempotent: a repeat request returns the original proof.
  const destroyed = await eraser.destroySubjectKey(subject);
  if (!destroyed.ok) {
    return err({ kind: "key-destruction-failed", cause: destroyed.error });
  }

  // Steps 6-9 — invalidate caches and routing memory, emit proof, confirm within the window.
  return ok({
    kind: "erased",
    subject,
    proof: destroyed.value,
    invalidated: DATA_MAP,
    dueBy: new Date(Date.parse(request.receivedAt) + ONE_MONTH_MS).toISOString(),
  });
}
