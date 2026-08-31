---
paths:
  - "src/**/infrastructure/**/*.ts"
  - "src/*/interface/**/*.ts"
  - "scripts/**/*.ts"
  - "docker/**"
---

# Runtime

Custodian is pre-implementation (see `CLAUDE.md`) — nothing below is built yet. This documents the
concrete decisions for when Phase 1+ actually needs a server or a UI, so they don't get re-derived
or contradicted later. Verified against Bun's own docs, not recalled from training memory.

## HTTP server: `Bun.serve`, not Express/Fastify/Hono

Native `Bun.serve({ routes: {...}, fetch(req) {...} })`. No third-party HTTP framework unless a
real gap shows up (routing, streaming, WebSocket, and TLS are all built in).

- **Graceful shutdown**: `await server.stop()` waits for in-flight requests and open WebSockets to
  finish before closing; `server.stop(true)` force-closes everything immediately. Wire this to
  `SIGTERM`/`SIGINT` (`process.on("SIGTERM", async () => { await server.stop(); process.exit(0) })`)
  — this is the actual mechanism behind Reliability & Operations' incident/DR posture, not a
  hypothetical to build custom.
- **TLS**: `tls: { key, cert }` in `Bun.serve()`. HTTP/2 (`http2: true`) is Bun's own
  **experimental** designation — don't rely on it for anything Test & Security Assurance treats as
  a release gate until it's out of experimental.

## Real-time / streaming — maps directly onto the 7 agent states

The interface standards' agent states (Queued/Thinking/Acting/Awaiting approval/Streaming/
Recovering/Failed) need a live channel to the UI. Two native primitives cover it, no library:

- **Streaming state** (partial output rendered progressively): return a `Response` whose body is an
  async generator — each `yield` flushes a chunk. `server.timeout(req, 0)` first, since `Bun.serve`
  closes idle connections after 10s by default and a quiet SSE stream looks idle.
- **Other six states** (state transitions, not token-by-token output): `Bun.serve`'s native
  WebSocket + pub/sub (`ws.subscribe(topic)`, `server.publish(topic, data)`) — declare handlers once
  per server (`open`/`message`/`close`/`drain`), not per connection. Attach tenant/session context via
  `data` in `server.upgrade(req, { data })`, typed via the `websocket.data` property.

## Frontend (Phase 5 UI work)

`bun init --react` scaffolds the actual pattern to use: a `Bun.serve` backend importing `.html`
files directly (`import index from "./index.html"; routes: { "/": index }`) — Bun's bundler,
transpiler, and CSS parser run on whatever the HTML pulls in (React, TypeScript, Tailwind), no
separate build tool. `development: true` gives HMR + source maps + unminified output;
`development: false` (or ahead-of-time `bun build --target=bun`) is the production path.

**React Router** layers on top of this for client-side routing once there's more than one screen —
load the `react-router` skill to pick a mode (it explicitly warns: identify the mode first,
Framework-mode guidance applied to a Declarative-mode app is wrong even where the API exists in
both). Given the `Bun.serve` + HTML-import pattern above already owns bundling and the API layer,
Declarative or Data mode (client-side routing) fits more naturally than Framework mode (which wants
to own the server/bundler itself) — confirm this against the actual UI's needs when Phase 5 starts,
don't treat it as decided.

## Process & environment

- **Env vars**: `Bun.env`/`process.env`/`import.meta.env` are all the same object — `.env` files
  load automatically, no `dotenv` package. (This matches the machine-level preference too, but it holds here regardless of who is working.)
- **Signal handling**: `process.on("SIGTERM"|"SIGINT", ...)` — Bun implements Node's `process`
  global. Neither `beforeExit` nor `exit` fires if the process is killed by a signal with no
  listener, so a signal you want to clean up on needs an explicit listener that calls
  `process.exit()` itself.

## Not evaluated yet — real Bun-ecosystem options if a real need arises

`Bun.serve` covers everything above natively. If a genuine need for a framework layer shows up
later (Drizzle/Prisma for a DB, Hono/Elysia for a router abstraction), Bun has first-class,
documented integration guides for each — check `bun-docs` before assuming Node-ecosystem setup
instructions apply as-is.
