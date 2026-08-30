import { expect, test } from "bun:test";
import {
  executeOnce,
  InMemoryIdempotencyStore,
  parseRequestHash,
  type RecordedOutcome,
} from "@custodian/idempotency";

const HASH = "a".repeat(64);

function hash() {
  const parsed = parseRequestHash(HASH);
  if (!parsed.ok) throw new Error("fixture: bad request hash");
  return parsed.value;
}

const SUCCESS: RecordedOutcome = { status: "succeeded", body: "charged once" };

test("the claim is persisted before the provider is invoked", async () => {
  const order: string[] = [];
  const store = new InMemoryIdempotencyStore({
    onWrite: () => {
      order.push("claim");
    },
  });

  await executeOnce({
    store,
    request: hash(),
    at: "2026-08-29T00:00:00.000Z",
    invoke: () => {
      order.push("invoke");
      return Promise.resolve(SUCCESS);
    },
  });

  expect(order[0]).toBe("claim");
  expect(order).toContain("invoke");
});

test("a second delivery returns the first outcome without invoking again", async () => {
  const store = new InMemoryIdempotencyStore({ onWrite: () => undefined });
  let invocations = 0;
  const invoke = () => {
    invocations += 1;
    return Promise.resolve(SUCCESS);
  };

  const first = await executeOnce({
    store,
    request: hash(),
    at: "2026-08-29T00:00:00.000Z",
    invoke,
  });
  const second = await executeOnce({
    store,
    request: hash(),
    at: "2026-08-29T00:00:05.000Z",
    invoke,
  });

  expect(first).toEqual({ ok: true, value: SUCCESS });
  expect(second).toEqual({ ok: true, value: SUCCESS });
  expect(invocations).toBe(1);
});

test("a replay arriving before the first call completes is refused, not duplicated", async () => {
  const store = new InMemoryIdempotencyStore({ onWrite: () => undefined });
  const claimed = await store.claim(hash(), "2026-08-29T00:00:00.000Z");
  expect(claimed.ok).toBe(true);

  const replay = await executeOnce({
    store,
    request: hash(),
    at: "2026-08-29T00:00:01.000Z",
    invoke: () => Promise.reject(new Error("must not be invoked")),
  });

  expect(replay).toEqual({ ok: false, error: { kind: "in-flight", request: hash() } });
});
