import { brand, type Brand } from "../language/brand";
import { err, ok, type Result } from "../language/result";

/**
 * A time window whose key is destroyed on the retention schedule. Execution-log content sits in a
 * monthly bucket destroyed at 30 days; metadata carries no bucket and survives 24 months
 * (data-protection-and-retention.txt:117-128).
 */
export type RetentionBucket = Brand<string, "RetentionBucket">;

export type InvalidRetentionBucket = {
  readonly kind: "invalid-retention-bucket";
  readonly received: string;
};

const RETENTION_BUCKET_PATTERN = /^[a-z][a-z-]*-\d{4}-\d{2}$/;

export function parseRetentionBucket(
  value: string,
): Result<RetentionBucket, InvalidRetentionBucket> {
  if (!RETENTION_BUCKET_PATTERN.test(value)) {
    return err({ kind: "invalid-retention-bucket", received: value });
  }
  return ok(brand<RetentionBucket>(value));
}
