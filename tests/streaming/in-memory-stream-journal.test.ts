import { expect, test } from "bun:test";
import { parseRunId } from "@custodian/execution-log";
import { InMemoryStreamJournal, STREAMING_RESPONSE_HEADERS } from "@custodian/streaming";

function run() {
  const parsed = parseRunId("r_01jd7k9h2m4n6p8r0s2t4v6x8z");
  if (!parsed.ok) throw new Error("fixture: bad run id");
  return parsed.value;
}

async function journalOfThree() {
  const journal = new InMemoryStreamJournal();
  for (const chunk of ["alpha", "beta", "gamma"]) {
    await journal.append(run(), chunk);
  }
  return journal;
}

test("appending returns a monotonically increasing offset", async () => {
  const journal = new InMemoryStreamJournal();
  const first = await journal.append(run(), "alpha");
  const second = await journal.append(run(), "beta");

  expect(first).toEqual({ ok: true, value: 0 });
  expect(second).toEqual({ ok: true, value: 1 });
});

test("a client that dropped after chunk one resumes from chunk two, not from scratch", async () => {
  const journal = await journalOfThree();
  expect(await journal.since(run(), 1)).toEqual({ ok: true, value: ["beta", "gamma"] });
});

test("resuming from the head returns nothing rather than replaying the stream", async () => {
  const journal = await journalOfThree();
  expect(await journal.since(run(), 3)).toEqual({ ok: true, value: [] });
});

test("resuming an unknown run is an error, not a silent empty stream", async () => {
  const journal = new InMemoryStreamJournal();
  expect(await journal.since(run(), 0)).toEqual({
    ok: false,
    error: { kind: "unknown-run", runId: run() },
  });
});

test("streaming responses defeat CDN buffering", () => {
  expect(STREAMING_RESPONSE_HEADERS).toEqual({
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
  });
});
