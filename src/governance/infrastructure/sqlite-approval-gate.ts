import { Database } from "bun:sqlite";
import {
  disposalCutoff,
  err,
  ok,
  parsePrincipalId,
  type ActionClass,
  type PrincipalId,
  type Result,
} from "@custodian/primitives";
import {
  LANE_POLICIES,
  laneFor,
  type ApprovalGate,
  type Lane,
  type ReviewOutcome,
  type ReviewRequest,
} from "../domain/decision-lane";
import {
  byUrgency,
  deadlineFor,
  type PendingReview,
  type ReviewState,
} from "../domain/pending-review";
import { briefFor, type ReviewBrief } from "../domain/review-brief";
import type { DecisionRefusal } from "../domain/review-decision";
import { generateReviewId, parseReviewId, type ReviewId } from "../domain/review-id";

type ReviewRow = {
  readonly id: string;
  readonly action: string;
  readonly lane: string;
  readonly requested_at: string;
  readonly deadline_at: string;
  readonly state: string;
  readonly presented_to: string | null;
  readonly presented_at: string | null;
  readonly reviewer: string | null;
  readonly took_ms: number | null;
};

/** A row that a named reviewer currently holds, which is the precondition for deciding it. */
type HeldReview = {
  readonly lane: Lane;
  readonly presentedAt: string;
  readonly heldSince: number;
};

type Decision = {
  readonly review: ReviewId;
  readonly reviewer: PrincipalId;
  readonly state: "approved" | "rejected";
  readonly held: HeldReview;
  readonly at: number;
};

/**
 * Half a percent of the fast lane's ten-second SLA, so a decision is observed within a rounding
 * error of when it landed. Polling rather than an in-process callback because the console that
 * answers a review is not necessarily the process that asked for it, and a resolver map is silently
 * wrong the moment it is not — writing the queue down is the whole point of writing it down.
 */
const DECISION_POLL_MS = 50;

/**
 * The approval queue as a durable read model, and the only implementation of `ApprovalGate`.
 *
 * Until this existed `seekApproval` denied every action outside the fast lane. That is the correct
 * default and it makes the platform unusable: an agent permitted only to read is not an agent.
 *
 * The design problem is not throughput. Fifty agents at twenty tool calls an hour produce a
 * thousand approval-eligible events an hour, and routing a tenth of them to people costs three
 * full-time equivalents doing nothing but clicking. A queue built to move that volume faster
 * manufactures the rubber-stamping the gate exists to prevent, so this one is built to make
 * carelessness harder: an item is handed to one named reviewer before it can be decided, the
 * handover is recorded, and an approval arriving faster than the lane's consideration floor is
 * refused rather than counted.
 */
export class SqliteApprovalGate implements ApprovalGate {
  readonly #db: Database;
  readonly #now: () => number;

  constructor(path: string, now: () => number = Date.now) {
    this.#now = now;
    this.#db = new Database(path, { create: true, strict: true });
    this.#db.run("PRAGMA journal_mode = WAL;");
    this.#db.run("PRAGMA busy_timeout = 5000;");
    this.#db.run(
      `CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        lane TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        deadline_at TEXT NOT NULL,
        state TEXT NOT NULL,
        presented_to TEXT,
        presented_at TEXT,
        reviewer TEXT,
        decided_at TEXT,
        took_ms INTEGER
      ) WITHOUT ROWID;`,
    );
    this.#expireOverdue();
  }

  /**
   * Enqueue, then wait for a decision or for the lane's SLA, whichever lands first. A timeout
   * returns `timed-out` rather than a verdict, because the fail-safe rule belongs to
   * `resolveReview` — the fast lane proceeds, every other lane denies — and deciding it twice is
   * two places for it to drift.
   */
  async request(review: ReviewRequest): Promise<ReviewOutcome> {
    const lane = laneFor(review.action);
    const deadlineAt = deadlineFor(review);
    if (deadlineAt === undefined) {
      // An unreadable request timestamp yields no deadline anyone could enforce, so the request is
      // treated as unanswered rather than handed an invented one.
      return { kind: "timed-out", lane, waitedMs: 0 };
    }

    const id = this.#enqueue(review, lane, deadlineAt);
    const startedAt = this.#now();
    const deadline = Date.parse(deadlineAt);
    for (;;) {
      const decided = this.#decision(id);
      if (decided !== undefined) {
        return decided;
      }
      if (this.#now() >= deadline) {
        this.#expire(id);
        // A decision landing in the same instant wins the guarded update, so the expiry is re-read
        // rather than assumed: whichever write got there first is the one that happened.
        return this.#decision(id) ?? { kind: "timed-out", lane, waitedMs: this.#now() - startedAt };
      }
      await Bun.sleep(DECISION_POLL_MS);
    }
  }

  /**
   * Everything still awaiting a person, in the order it should be worked. The ordering runs through
   * the domain comparator rather than an `ORDER BY`, so the rule has one home — and a queue sized
   * for humans is not where a sort belongs in the query planner anyway.
   */
  queue(): readonly PendingReview[] {
    this.#expireOverdue();
    const at = this.#now();
    const rows = this.#db
      .query<ReviewRow, [string]>(
        "SELECT * FROM reviews WHERE state = 'pending' AND deadline_at > ? ORDER BY id",
      )
      .all(new Date(at).toISOString());
    const pending: PendingReview[] = [];
    for (const row of rows) {
      const parsed = parsePending(row, at);
      if (parsed !== undefined) {
        pending.push(parsed);
      }
    }
    return pending.sort(byUrgency);
  }

  /**
   * Hand one item to one named reviewer and record that it happened. This is the step a decision
   * refuses to proceed without: an approval whose consequence was never put in front of anybody is
   * not a review, and the record of who was shown what — and for how long — is what turns
   * `assessOversight` from a theory into a measurement.
   *
   * A second reviewer cannot take an item out of the first one's hands. Letting them would be the
   * quiet version of the failure this whole component is against: the first reviewer reads the
   * brief, decides, and is told they were never shown it — a real review thrown away, and the row
   * handed to whoever clicked last. A hold that is abandoned is released by the SLA rather than by
   * a colleague, and an abandoned hold therefore fails safe.
   */
  open(review: ReviewId, reviewer: PrincipalId): Result<ReviewBrief, DecisionRefusal> {
    const at = new Date(this.#now()).toISOString();
    const stamped = this.#db.run(
      `UPDATE reviews SET presented_to = ?, presented_at = ?
       WHERE id = ? AND state = 'pending' AND deadline_at > ?
         AND (presented_to IS NULL OR presented_to = ?)`,
      [reviewer, at, review, at, reviewer],
    );
    if (stamped.changes === 0) {
      return err(this.#refusal(review, reviewer));
    }
    const pending = this.#pending(review);
    return pending === undefined
      ? err({ kind: "unknown-review", review })
      : ok(briefFor(pending, at));
  }

  approve(review: ReviewId, reviewer: PrincipalId): Result<ReviewOutcome, DecisionRefusal> {
    const held = this.#held(review, reviewer);
    if (!held.ok) {
      return held;
    }
    const decidableFrom = held.value.heldSince + LANE_POLICIES[held.value.lane].minConsiderationMs;
    const at = this.#now();
    if (at < decidableFrom) {
      return err({
        kind: "too-soon",
        review,
        decidableFrom: new Date(decidableFrom).toISOString(),
      });
    }
    return this.#decide({ review, reviewer, state: "approved", held: held.value, at });
  }

  /**
   * No consideration floor on the way out. The floor exists to stop an approval nobody read, and a
   * rejection is the direction this component already fails in — slowing one down buys nothing and
   * spends SLA the queue does not have.
   */
  reject(review: ReviewId, reviewer: PrincipalId): Result<ReviewOutcome, DecisionRefusal> {
    const held = this.#held(review, reviewer);
    return held.ok
      ? this.#decide({
          review,
          reviewer,
          state: "rejected",
          held: held.value,
          at: this.#now(),
        })
      : held;
  }

  /**
   * Who allowed what, and how long they had it in front of them, is a human-intervention record in
   * the execution log's sense, so it is kept and disposed of on that schedule rather than cleared
   * on request. Nothing here is sealed because nothing here is subject content: an action class, a
   * lane, four timestamps and a pseudonymous reviewer identifier.
   */
  disposeExpired(): number {
    return this.#db.run(
      "DELETE FROM reviews WHERE state != 'pending' AND decided_at IS NOT NULL AND decided_at <= ?",
      [disposalCutoff("execution-log-metadata", new Date(this.#now()).toISOString())],
    ).changes;
  }

  close(): void {
    this.#db.close();
  }

  #enqueue(review: ReviewRequest, lane: Lane, deadlineAt: string): ReviewId {
    const id = generateReviewId();
    this.#db.run(
      `INSERT INTO reviews (id, action, lane, requested_at, deadline_at, state)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [id, review.action, lane, review.requestedAt, deadlineAt],
    );
    return id;
  }

  #held(review: ReviewId, reviewer: PrincipalId): Result<HeldReview, DecisionRefusal> {
    const row = this.#row(review);
    if (row === undefined) {
      return err({ kind: "unknown-review", review });
    }
    if (
      row.state !== "pending" ||
      Date.parse(row.deadline_at) <= this.#now() ||
      row.presented_at === null ||
      row.presented_to !== String(reviewer)
    ) {
      return err(this.#refusal(review, reviewer));
    }
    const lane = parseLane(row.lane);
    const heldSince = Date.parse(row.presented_at);
    // A row this process wrote and cannot read back is corrupt, and a corrupt row is not something
    // to decide on — it is reported as absent rather than repaired into a decision.
    return lane === undefined || Number.isNaN(heldSince)
      ? err({ kind: "unknown-review", review })
      : ok({ lane, presentedAt: row.presented_at, heldSince });
  }

  /**
   * The write that decides everything. `state = 'pending'`, the deadline and the exact presentation
   * timestamp are all in the WHERE clause, so a decision arriving after the SLA expired, after
   * somebody else answered, or after the item was re-opened changes no rows and comes back as a
   * refusal. It never becomes an approval for an action the platform already refused.
   */
  #decide(decision: Decision): Result<ReviewOutcome, DecisionRefusal> {
    const { review, reviewer, state, held, at } = decision;
    const decidedAt = new Date(at).toISOString();
    const tookMs = at - held.heldSince;
    const decided = this.#db.run(
      `UPDATE reviews SET state = ?, reviewer = ?, decided_at = ?, took_ms = ?
       WHERE id = ? AND state = 'pending' AND deadline_at > ? AND presented_to = ?
         AND presented_at = ?`,
      [state, reviewer, decidedAt, tookMs, review, decidedAt, reviewer, held.presentedAt],
    );
    return decided.changes === 0
      ? err(this.#refusal(review, reviewer))
      : ok({ kind: state, reviewer, tookMs });
  }

  #decision(review: ReviewId): ReviewOutcome | undefined {
    const row = this.#row(review);
    if (row === undefined || row.reviewer === null) {
      return undefined;
    }
    if (row.state !== "approved" && row.state !== "rejected") {
      return undefined;
    }
    // The identity goes back out through the parser it came in through. A reviewer who cannot be
    // named is not a reviewer, and reporting one would put an unverifiable name in the record of
    // who allowed the action — so the request waits instead and its lane's fail-safe takes over.
    const reviewer = parsePrincipalId(row.reviewer);
    return reviewer.ok
      ? { kind: row.state, reviewer: reviewer.value, tookMs: row.took_ms ?? 0 }
      : undefined;
  }

  #pending(review: ReviewId): PendingReview | undefined {
    const row = this.#row(review);
    return row === undefined ? undefined : parsePending(row, this.#now());
  }

  /** Why a guarded update matched nothing, read back so the screen can say which of the five. */
  #refusal(review: ReviewId, reviewer: PrincipalId): DecisionRefusal {
    const row = this.#row(review);
    const state = row === undefined ? undefined : parseState(row.state);
    // A row this process wrote and cannot read back is corrupt, and a corrupt row is not something
    // to decide on. Reporting it as absent is the same choice `#held` makes, and it beats naming a
    // state the table does not actually hold.
    if (row === undefined || state === undefined) {
      return { kind: "unknown-review", review };
    }
    if (state !== "pending") {
      return { kind: "already-decided", review, state };
    }
    if (Date.parse(row.deadline_at) <= this.#now()) {
      return { kind: "deadline-passed", review, deadlineAt: row.deadline_at };
    }
    const holder =
      row.presented_to === null || row.presented_to === String(reviewer)
        ? undefined
        : parsePrincipalId(row.presented_to);
    if (holder !== undefined) {
      return holder.ok
        ? { kind: "held-by-another", review, presentedTo: holder.value }
        : { kind: "unknown-review", review };
    }
    return { kind: "not-presented", review };
  }

  #row(review: ReviewId): ReviewRow | undefined {
    return (
      this.#db.query<ReviewRow, [string]>("SELECT * FROM reviews WHERE id = ?").get(review) ??
      undefined
    );
  }

  /**
   * A crash leaves rows pending past their deadline. The guarded writes above already refuse them,
   * so this is reconciliation rather than enforcement — but a queue that shows an item whose
   * decision can no longer apply is inviting the one thing this component must never do.
   */
  #expireOverdue(): void {
    this.#db.run(
      `UPDATE reviews SET state = 'timed-out', decided_at = deadline_at
       WHERE state = 'pending' AND deadline_at <= ?`,
      [new Date(this.#now()).toISOString()],
    );
  }

  #expire(review: ReviewId): void {
    this.#db.run(
      `UPDATE reviews SET state = 'timed-out', decided_at = deadline_at
       WHERE id = ? AND state = 'pending'`,
      [review],
    );
  }
}

/** A stored row is untrusted input; it crosses back through a parser rather than an assertion. */
function parsePending(row: ReviewRow, at: number): PendingReview | undefined {
  const action = parseActionClass(row.action);
  const lane = parseLane(row.lane);
  const review = parseReviewId(row.id);
  if (action === undefined || lane === undefined || !review.ok) {
    return undefined;
  }
  const presented = row.presented_to === null ? undefined : parsePrincipalId(row.presented_to);
  return {
    review: review.value,
    action,
    lane,
    requestedAt: row.requested_at,
    deadlineAt: row.deadline_at,
    remainingMs: Date.parse(row.deadline_at) - at,
    presentedTo: presented !== undefined && presented.ok ? presented.value : undefined,
  };
}

function parseActionClass(value: string): ActionClass | undefined {
  return value === "low-risk-reversible" ||
    value === "sensitive-data-access" ||
    value === "financial-or-irreversible"
    ? value
    : undefined;
}

function parseLane(value: string): Lane | undefined {
  return value === "fast" || value === "standard" || value === "high" ? value : undefined;
}

function parseState(value: string): ReviewState | undefined {
  return value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "timed-out"
    ? value
    : undefined;
}
