import { streamEvent } from "../domain/stream-event";

/**
 * The one thing this needs from `Bun.serve`'s server object, named structurally so a test can
 * observe the call without an assertion. `Server` satisfies it; nothing else in it is used.
 */
export type IdleTimeoutControl = {
  timeout(request: Request, seconds: number): void;
};

const HEADERS: Readonly<Record<string, string>> = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
};

/**
 * Partial output, streamed.
 *
 * The other six states ride the WebSocket channel because they are transitions — discrete, ordered,
 * and worth fanning out to several watchers. Token-by-token output is neither: it belongs to one
 * reader, arrives continuously, and would spend the pub/sub budget on the least interesting traffic
 * in the system. So it gets its own response body, as an async generator: each `yield` flushes, and
 * the client disconnecting returns the generator so the loop stops on its own.
 *
 * `server.timeout(request, 0)` is not optional and not a tuning knob. `Bun.serve` closes a
 * connection after 10 seconds of inactivity, and it counts a response that has not written bytes as
 * inactive — so a model that pauses to think looks idle and the browser sees a connection reset
 * mid-answer. Disabling it per request rather than raising the global `idleTimeout` keeps the bound
 * on every other route, where a stalled request should still be cut off.
 *
 * The Article 50 disclosure is not emitted here. It is an obligation on the surface that renders
 * this, at first contact and in the same visual weight as the primary text — a marker in the byte
 * stream would satisfy neither half, and pretending otherwise is worse than leaving it to F3.
 */
export function streamedOutput(
  request: Request,
  server: IdleTimeoutControl,
  chunks: AsyncIterable<string>,
): Response {
  server.timeout(request, 0);
  return new Response(
    async function* () {
      for await (const chunk of chunks) {
        yield streamEvent(chunk);
      }
    },
    { headers: HEADERS },
  );
}
