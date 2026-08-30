import { expect, test } from "bun:test";
import { parseRetentionBucket } from "@custodian/domain-primitives";
import {
  bucketFor,
  type DurationClass,
  RETENTION_SCHEDULE,
  type RetentionClass,
} from "@custodian/retention";

const AT = "2026-08-29T00:00:00.000Z";

test("every duration class produces a bucket the parser accepts", () => {
  // bucketFor builds rather than parses, on the grounds that its inputs are literals from a closed
  // union. This is what keeps that grounds true — add a class whose name breaks the bucket pattern
  // and this fails rather than the brand silently carrying an unparseable value.
  const isDuration = (name: RetentionClass): name is DurationClass =>
    RETENTION_SCHEDULE[name].kind === "duration";

  const classes = Object.keys(RETENTION_SCHEDULE).filter((name): name is RetentionClass =>
    Object.hasOwn(RETENTION_SCHEDULE, name),
  );
  expect(classes.length).toBeGreaterThan(0);
  for (const name of classes.filter(isDuration)) {
    expect(parseRetentionBucket(bucketFor(name, AT)).ok).toBe(true);
  }
});

test("classes with different tenant rights never share a bucket key", () => {
  // Destroying a bucket destroys one key. prompts-and-completions is tenant-configurable to zero
  // and execution-log-content is not, so sharing a key would let a tenant exercising the first
  // destroy the Article 73 window with it.
  expect(bucketFor("prompts-and-completions", AT)).not.toBe(bucketFor("execution-log-content", AT));
});

test("a bucket covers one month, so disposal is monthly rather than per-record", () => {
  expect(bucketFor("execution-log-content", AT)).toBe(
    bucketFor("execution-log-content", "2026-08-01T00:00:00.000Z"),
  );
  expect(bucketFor("execution-log-content", AT)).not.toBe(
    bucketFor("execution-log-content", "2026-09-01T00:00:00.000Z"),
  );
});
