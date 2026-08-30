import { afterAll, expect, test } from "bun:test";
import { err, ok, type Namespace, type RunId, type Result } from "@custodian/primitives";
import {
  agentStateChannel,
  broadcastVia,
  frameToWire,
  parseStateFrame,
  type AdmissionRefusal,
  type StateFrame,
} from "@custodian/surfaces";
import { ACME, GLOBEX, namespaceOf, RUN_A } from "./viewer-fixtures";

const AT = "2026-08-30T12:00:00.000Z";

/**
 * The composition root's job, in miniature: turn a credential into a namespace, or refuse. The real
 * one verifies a signed claim; this one trusts a header, because the point under test is what the
 * transport does with the namespace it is handed, not how the namespace was earned.
 */
function admit(request: Request): Result<Namespace, AdmissionRefusal> {
  const tenant = request.headers.get("x-tenant-claim");
  if (tenant !== ACME && tenant !== GLOBEX) {
    return err({ kind: "not-a-viewer" });
  }
  return ok(namespaceOf(tenant));
}

const channel = agentStateChannel({ admit });

const server = Bun.serve({
  port: 0,
  websocket: channel.websocket,
  fetch: (request, self) => channel.upgrade(request, self) ?? new Response(null, { status: 101 }),
});

const broadcast = broadcastVia(server);

afterAll(() => {
  // Not awaited, deliberately. In Bun 1.3.14 the promise from `stop()` never resolves once the
  // server has itself called `ws.close(...)` on a connection — verified in isolation, with nothing
  // of ours involved. Awaiting it hangs the suite in this hook with every assertion already green,
  // which reads as a failure in the last test rather than in the teardown.
  void server.stop(true);
});

const address = `ws://localhost:${String(server.port)}/states`;

function frameFor(runId: RunId, sequence: number): StateFrame {
  return {
    runId,
    sequence,
    at: AT,
    state: { kind: "thinking", objective: "Find the invoice for August." },
  };
}

/** A viewer that records everything it is sent, and can be asked to watch a run. */
async function viewerFor(tenant: string): Promise<{
  readonly received: string[];
  watch(runId: string): Promise<void>;
  close(): void;
}> {
  const socket = new WebSocket(address, { headers: { "x-tenant-claim": tenant } });
  const received: string[] = [];
  socket.addEventListener("message", (event) => {
    received.push(String(event.data));
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve();
    });
    socket.addEventListener("error", () => {
      reject(new Error("fixture: socket refused"));
    });
  });
  return {
    received,
    watch: async (runId) => {
      socket.send(JSON.stringify({ kind: "watch", runId }));
      // The subscription is applied on the server's next turn; nothing acknowledges it, so the
      // test waits rather than racing the publish that follows.
      await Bun.sleep(25);
    },
    close: () => {
      socket.close();
    },
  };
}

test("a viewer watching its own run receives its states", async () => {
  const acme = await viewerFor(ACME);
  await acme.watch(RUN_A);

  broadcast.announce({ namespace: namespaceOf(ACME), frame: frameFor(RUN_A, 1) });
  await Bun.sleep(25);
  acme.close();

  expect(acme.received).toEqual([frameToWire(frameFor(RUN_A, 1))]);
});

test("a viewer asking to watch another workspace's run hears nothing", async () => {
  const acme = await viewerFor(ACME);
  const globex = await viewerFor(GLOBEX);

  // Globex names Acme's run id — the identifier is not a secret and may well have leaked. The
  // request is accepted, because refusing it would confirm the run exists; it simply subscribes
  // Globex to a channel inside Globex's own workspace that nothing ever publishes to.
  await acme.watch(RUN_A);
  await globex.watch(RUN_A);

  broadcast.announce({ namespace: namespaceOf(ACME), frame: frameFor(RUN_A, 1) });
  await Bun.sleep(25);
  acme.close();
  globex.close();

  expect(acme.received.length).toBe(1);
  expect(globex.received).toEqual([]);
});

test("a viewer receives nothing for a run it has not asked to watch", async () => {
  const acme = await viewerFor(ACME);

  broadcast.announce({ namespace: namespaceOf(ACME), frame: frameFor(RUN_A, 1) });
  await Bun.sleep(25);
  acme.close();

  expect(acme.received).toEqual([]);
});

test("what arrives is a frame the receiver can parse", async () => {
  const acme = await viewerFor(ACME);
  await acme.watch(RUN_A);

  broadcast.announce({ namespace: namespaceOf(ACME), frame: frameFor(RUN_A, 4) });
  await Bun.sleep(25);
  acme.close();

  const parsed = parseStateFrame(acme.received[0] ?? "");
  expect(parsed.ok ? parsed.value : parsed.error).toEqual(frameFor(RUN_A, 4));
});

test("a connection without a credential is refused before it becomes a socket", async () => {
  const response = await fetch(`http://localhost:${String(server.port)}/states`);

  expect(response.status).toBe(401);
});

test("a message the transport has no vocabulary for closes the connection", async () => {
  const socket = new WebSocket(address, { headers: { "x-tenant-claim": ACME } });
  const closed = new Promise<number>((resolve) => {
    socket.addEventListener("close", (event) => {
      resolve(event.code);
    });
  });
  await new Promise<void>((resolve) => {
    socket.addEventListener("open", () => {
      resolve();
    });
  });

  // Silence here would leave the viewer rendering its last state and believing it was live, which
  // is the failure the seven states exist to prevent.
  socket.send(JSON.stringify({ subscribe: "state:tenant:t_someone_else:run:r_x" }));

  expect(await closed).toBe(1008);
});
