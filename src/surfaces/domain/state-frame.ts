import { err, isRecord, ok, parseRunId, type Result, type RunId } from "@custodian/primitives";
import type { InvalidRunId } from "@custodian/primitives";
import type { AgentState } from "./agent-state";
import { parseAgentState, type StateRejection } from "./parse-agent-state";
import { readCount, readString } from "./wire-value";

/**
 * One agent state, as it travels to a browser.
 *
 * **The frame deliberately does not carry a namespace or a tenant.** The subscriber's namespace is
 * a property of the *connection*, fixed from a verified claim at upgrade and never re-read from
 * anything the client sent. Putting it in the frame would create a second, weaker answer to "whose
 * data is this" — and the moment two answers exist, some code path picks the wrong one. The frame
 * says only what a viewer already entitled to see this run is allowed to know.
 *
 * `sequence` earns its place on a mechanism rather than a hunch: `Server.publish` returns 0 when a
 * message is dropped and -1 under backpressure, and Bun's pub/sub has no per-subscriber
 * acknowledgement, so a viewer can miss a frame with nothing anywhere reporting it. A gap in the
 * sequence is how the viewer finds out, and re-reads the run instead of rendering a stale state as
 * the current one.
 */
export type StateFrame = {
  readonly runId: RunId;
  readonly sequence: number;
  /** ISO-8601. Checked on parse, because an unrenderable timestamp renders as "Invalid Date". */
  readonly at: string;
  readonly state: AgentState;
};

export type FrameRejection = { readonly kind: "not-json" } | InvalidRunId | StateRejection;

export function frameToWire(frame: StateFrame): string {
  return JSON.stringify({
    runId: frame.runId,
    sequence: frame.sequence,
    at: frame.at,
    state: frame.state,
  });
}

/**
 * The inbound half of the boundary. A frame arriving here is untrusted even when this process sent
 * it: the serialiser and the parser are separated by a network, and treating "we wrote this" as a
 * guarantee is how a version skew becomes a runtime throw in a browser.
 */
export function parseStateFrame(text: string): Result<StateFrame, FrameRejection> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err({ kind: "not-json" });
  }
  if (!isRecord(parsed)) {
    return err({ kind: "not-json" });
  }

  const rawRunId = readString(parsed, "runId");
  if (!rawRunId.ok) {
    return rawRunId;
  }
  const runId = parseRunId(rawRunId.value);
  if (!runId.ok) {
    return runId;
  }
  const sequence = readCount(parsed, "sequence");
  if (!sequence.ok) {
    return sequence;
  }
  const at = readString(parsed, "at");
  if (!at.ok) {
    return at;
  }
  if (Number.isNaN(Date.parse(at.value))) {
    return err({ kind: "field-malformed", field: "at" });
  }
  const state = parseAgentState(parsed["state"]);
  return state.ok
    ? ok({ runId: runId.value, sequence: sequence.value, at: at.value, state: state.value })
    : state;
}
