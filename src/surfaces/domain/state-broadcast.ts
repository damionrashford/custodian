import type { Namespace } from "@custodian/primitives";
import type { StateFrame } from "./state-frame";

/**
 * A frame plus the routing key it must never travel with.
 *
 * The namespace and the frame are separated here rather than merged because they have different
 * audiences: the namespace decides *who* is sent this, and the frame is *what they are sent*. Every
 * publisher therefore has to name the tenant explicitly, and the wire format has no field for it to
 * leak through.
 */
export type StateEnvelope = {
  readonly namespace: Namespace;
  readonly frame: StateFrame;
};

/**
 * Pushing one state to everyone watching that run, and to nobody else.
 *
 * The port exists so the code that produces states — a run loop, a retry, an approval timing out —
 * never imports a transport. Fire-and-forget on purpose: an agent run must not stall or fail because
 * a browser tab went away, so there is no delivery guarantee to await and none is implied.
 */
export interface StateBroadcast {
  announce(envelope: StateEnvelope): void;
}
