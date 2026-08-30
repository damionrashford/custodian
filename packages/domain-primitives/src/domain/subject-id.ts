import type { Brand } from "./brand";
import { err, ok, type Result } from "./result";

/**
 * A data subject under GDPR — the unit that gets its own data-encryption key and whose erasure
 * destroys that key (Data_Protection_and_Retention.txt:74).
 */
export type SubjectId = Brand<string, "SubjectId">;

export type InvalidSubjectId = {
  readonly kind: "invalid-subject-id";
  readonly received: string;
};

const SUBJECT_ID_PATTERN = /^s_[0-9a-z]{26}$/;

export function parseSubjectId(value: string): Result<SubjectId, InvalidSubjectId> {
  if (!SUBJECT_ID_PATTERN.test(value)) {
    return err({ kind: "invalid-subject-id", received: value });
  }
  return ok(value as SubjectId);
}
