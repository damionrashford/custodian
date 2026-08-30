import type { Server, WebSocketHandler } from "bun";
import type { Namespace, Result } from "@custodian/primitives";
import type { StateBroadcast } from "../domain/state-broadcast";
import { frameToWire } from "../domain/state-frame";
import { topicForRun } from "../domain/state-topic";
import { parseViewerRequest } from "../domain/viewer-request";

/**
 * What a connection is entitled to see, decided once at upgrade.
 *
 * Held on `ws.data` because that is the one place a client cannot reach. Every later decision —
 * which topic a `watch` resolves to, which frames arrive — reads this and nothing the socket
 * carries. Re-deriving it per message from anything the client sent would reintroduce exactly the
 * hole `ViewerRequest` was shaped to close.
 */
export type Viewer = { readonly namespace: Namespace };

export type AdmissionRefusal = { readonly kind: "not-a-viewer" };

export type ChannelDeps = {
  /**
   * Turns an upgrade request into the namespace whose runs this connection may watch.
   *
   * Injected rather than implemented here for two reasons. It keeps `surfaces` from depending on
   * the claim verifier, which is the wrong direction for a transport. And it means the composition
   * root cannot admit a viewer without a `Namespace`, whose only constructor is
   * `namespaceFor(claim)` over a *verified* claim — so the isolation guarantee is carried by the
   * signature rather than by whoever writes the wiring.
   */
  readonly admit: (request: Request) => Result<Namespace, AdmissionRefusal>;
};

export type AgentStateChannel = {
  readonly upgrade: (request: Request, server: Server<Viewer>) => Response | undefined;
  readonly websocket: WebSocketHandler<Viewer>;
};

/** Plain, short, and not user-facing copy: these land in a browser console, not on a screen. */
const REFUSED = "This workspace credential is invalid or expired.";
const NOT_AN_UPGRADE = "Open this address as a WebSocket.";

/**
 * Close codes rather than silence. A viewer whose request was dropped would keep rendering the last
 * state it saw and believe it was live, which is the failure the seven states exist to prevent;
 * closing tells it to reconnect and re-read.
 */
const UNSUPPORTED_DATA = 1003;
const POLICY_VIOLATION = 1008;

export function agentStateChannel(deps: ChannelDeps): AgentStateChannel {
  const websocket: WebSocketHandler<Viewer> = {
    // Handlers are declared once per server, not per connection — Bun reuses this object across
    // every socket, so nothing here may close over a single connection's state.
    message(ws, message) {
      if (typeof message !== "string") {
        ws.close(UNSUPPORTED_DATA, "text only");
        return;
      }
      const request = parseViewerRequest(message);
      if (!request.ok) {
        ws.close(POLICY_VIOLATION, "unsupported request");
        return;
      }
      // The namespace comes from `ws.data`; the client supplied only the run id. A viewer naming
      // another tenant's run therefore subscribes to a topic inside its own namespace, which no
      // publisher ever writes to — it hears nothing, and learns nothing about whether the run exists.
      const topic = topicForRun(ws.data.namespace, request.value.runId);
      if (request.value.kind === "watch") {
        ws.subscribe(topic);
      } else {
        ws.unsubscribe(topic);
      }
    },
  };

  return {
    websocket,
    upgrade: (request, server) => {
      const admitted = deps.admit(request);
      if (!admitted.ok) {
        return new Response(REFUSED, { status: 401 });
      }
      const viewer: Viewer = { namespace: admitted.value };
      return server.upgrade(request, { data: viewer })
        ? undefined
        : new Response(NOT_AN_UPGRADE, { status: 400 });
    },
  };
}

/**
 * The publishing half, kept separate because it needs the `Server` object, which exists only after
 * `Bun.serve` has been called with the handlers above. A setter on the channel would be a mutable
 * half-initialised adapter; a function over the server is neither.
 */
export function broadcastVia(server: Server<Viewer>): StateBroadcast {
  return {
    announce: (envelope) => {
      // The return value is deliberately unused: 0 means dropped and -1 means backpressure, and
      // there is nothing useful a run can do about either. That is what `StateFrame.sequence` is
      // for — the viewer notices the gap, because the publisher cannot.
      server.publish(
        topicForRun(envelope.namespace, envelope.frame.runId),
        frameToWire(envelope.frame),
      );
    },
  };
}
