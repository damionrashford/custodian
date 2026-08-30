/**
 * Five minutes. One replay window across the platform is one number to reason about during an
 * incident, which is why it lives here rather than beside each credential that uses it — it was
 * previously duplicated in `identity` and `event-delivery`, free to drift.
 *
 * A tenant claim deliberately does NOT use this: it is a bearer credential replayed on every query,
 * so it takes a bounded lifetime instead. See `knowledge-base/src/domain/tenant-claim.ts`.
 */
export const REPLAY_WINDOW_MS = 5 * 60 * 1000;
