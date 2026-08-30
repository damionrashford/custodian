import { err, isRecord, ok, parseRunId, type Result, type RunId } from "@custodian/primitives";
import type { InvalidRunId } from "@custodian/primitives";

/**
 * Everything a subscriber is allowed to say.
 *
 * **There is no topic field, and that absence is the security control.** The obvious transport —
 * the client sends the channel it wants and the server subscribes it — hands every viewer the
 * ability to name another tenant's channel, and no amount of checking afterwards recovers from
 * having offered the vocabulary in the first place. A viewer's whole vocabulary is a run id; the
 * namespace half of the topic comes from the connection's verified claim, which the client cannot
 * influence. So the transport never has to decide whether a requested topic is allowed, because a
 * requested topic is not a thing that exists.
 *
 * Two verbs rather than one because a long-lived operator console watches and stops watching many
 * runs over its life, and a connection that can only accumulate subscriptions leaks them until it
 * is reconnected.
 */
export type ViewerRequest =
  | { readonly kind: "watch"; readonly runId: RunId }
  | { readonly kind: "unwatch"; readonly runId: RunId };

export type ViewerRejection =
  | { readonly kind: "not-json" }
  | { readonly kind: "unknown-request"; readonly received: string }
  | InvalidRunId;

const VERBS: ReadonlySet<string> = new Set(["watch", "unwatch"]);

export function parseViewerRequest(text: string): Result<ViewerRequest, ViewerRejection> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err({ kind: "not-json" });
  }
  if (!isRecord(parsed)) {
    return err({ kind: "not-json" });
  }

  const verb = parsed["kind"];
  if (typeof verb !== "string" || !VERBS.has(verb)) {
    return err({ kind: "unknown-request", received: typeof verb === "string" ? verb : "" });
  }
  const raw = parsed["runId"];
  if (typeof raw !== "string") {
    return err({ kind: "invalid-run-id", received: "" });
  }
  const runId = parseRunId(raw);
  if (!runId.ok) {
    return runId;
  }
  return ok(
    verb === "watch"
      ? { kind: "watch", runId: runId.value }
      : { kind: "unwatch", runId: runId.value },
  );
}
