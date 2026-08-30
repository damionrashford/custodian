import { brand, type RetentionBucket } from "@custodian/domain-primitives";
import type { DurationClass } from "./retention-schedule";

/**
 * One bucket per retention class per month, so destroying a bucket key destroys exactly one class.
 * Sharing a bucket across classes silently couples their rights: `prompts-and-completions` is
 * tenant-configurable to zero and `execution-log-content` is not
 * (Data_Protection_and_Retention.txt:114-140), so a tenant exercising the first would have
 * destroyed the Article 73 window with it.
 *
 * Built rather than parsed: every input is a literal from a closed union plus a date, so there is
 * no untrusted value to reject. `tests/retention/retention-bucket-for.test.ts` asserts every class
 * produces a bucket `parseRetentionBucket` accepts, which is what keeps that claim true.
 */
export function bucketFor(retention: DurationClass, at: string): RetentionBucket {
  const month = at.slice(0, 7);
  return brand<RetentionBucket>(`${retention}-${month}`);
}
