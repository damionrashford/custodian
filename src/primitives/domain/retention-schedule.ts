/**
 * The retention schedule from Data_Protection_and_Retention.txt:114-140, encoded once as data.
 *
 * Two obligations pull in opposite directions: minimisation says delete, AI Act logging says
 * retain. The resolution is to separate content from evidence — retain the record that an action
 * occurred, minimise the personal content inside it. That is why the execution log appears twice
 * here with different periods.
 *
 * A schedule that lives only in prose is a schedule nothing enforces.
 */
export type RetentionClass =
  | "prompts-and-completions"
  | "execution-log-metadata"
  | "execution-log-content"
  | "vector-index"
  | "agent-memory"
  | "billing-records"
  | "backups";

export type RetentionRule =
  | {
      readonly kind: "duration";
      readonly days: number;
      readonly basis: string;
      /** Some classes may be shortened by a tenant, never lengthened. */
      readonly tenantConfigurableToZero: boolean;
    }
  | {
      readonly kind: "tenant-lifetime";
      readonly basis: string;
      readonly disposal: string;
    };

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_SCHEDULE: Readonly<Record<RetentionClass, RetentionRule>> = {
  "prompts-and-completions": {
    kind: "duration",
    days: 30,
    basis: "Debugging",
    tenantConfigurableToZero: true,
  },
  "execution-log-metadata": {
    kind: "duration",
    days: 730,
    basis: "AI Act deployer logging; SOC 2 evidence; Art.73 investigations",
    tenantConfigurableToZero: false,
  },
  "execution-log-content": {
    kind: "duration",
    days: 30,
    // NOT tenant-configurable. The spec grants that only to "prompts and completions"
    // (Data_Protection_and_Retention.txt:120-122); this class's basis is minimisation with
    // metadata retained, and zeroing it would remove the window Art.73 investigation reads.
    basis: "Minimisation - content redacted, metadata retained",
    tenantConfigurableToZero: false,
  },
  "vector-index": {
    kind: "tenant-lifetime",
    basis: "Retrieval quality",
    disposal: "Namespace drop on tenant offboarding",
  },
  "agent-memory": {
    kind: "duration",
    days: 365,
    basis: "Staleness risk beyond this outweighs recall value",
    tenantConfigurableToZero: true,
  },
  "billing-records": {
    kind: "duration",
    days: 2555,
    basis: "Statutory financial retention; pseudonymised",
    tenantConfigurableToZero: false,
  },
  backups: {
    kind: "duration",
    days: 35,
    basis: "Rolling; key destruction handles in-window erasure",
    tenantConfigurableToZero: false,
  },
};

/**
 * When a record of this class written at `writtenAt` becomes due for disposal. Undefined for
 * tenant-lifetime classes, which are dropped by an offboarding event rather than by a clock.
 */
/** Classes disposed of by a clock. Excludes tenant-lifetime, which is dropped by an offboarding event. */
export type DurationClass = Exclude<RetentionClass, "vector-index">;

/**
 * Total for duration classes, so a caller with a literal class needs no undefined branch. The
 * partial `expiresAt` below stays for callers holding a RetentionClass that could be either.
 */
export function expiresAtForDuration(retention: DurationClass, writtenAt: string): string {
  const rule = RETENTION_SCHEDULE[retention];
  if (rule.kind === "tenant-lifetime") {
    return writtenAt;
  }
  return new Date(Date.parse(writtenAt) + rule.days * DAY_MS).toISOString();
}

export function expiresAt(retention: RetentionClass, writtenAt: string): string | undefined {
  const rule = RETENTION_SCHEDULE[retention];
  if (rule.kind === "tenant-lifetime") {
    return undefined;
  }
  return new Date(Date.parse(writtenAt) + rule.days * DAY_MS).toISOString();
}

export function isDueForDisposal(
  retention: RetentionClass,
  writtenAt: string,
  now: string,
): boolean {
  const due = expiresAt(retention, writtenAt);
  return due !== undefined && Date.parse(now) >= Date.parse(due);
}

/**
 * The oldest `writtenAt` still inside its retention period at `now` — the mirror of
 * `expiresAtForDuration`, for stores that dispose with a single ranged delete rather than by
 * checking one record at a time.
 *
 * It exists so the period stays in the schedule. A sweeper that subtracted its own day count would
 * be a second copy of a legal position, free to drift from this table without failing the test that
 * transcribes the spec.
 */
export function disposalCutoff(retention: DurationClass, now: string): string {
  const rule = RETENTION_SCHEDULE[retention];
  if (rule.kind === "tenant-lifetime") {
    return now;
  }
  return new Date(Date.parse(now) - rule.days * DAY_MS).toISOString();
}
