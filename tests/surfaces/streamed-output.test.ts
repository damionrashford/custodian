import { expect, test } from "bun:test";
import { streamEvent, streamedOutput, type IdleTimeoutControl } from "@custodian/surfaces";

function recorder(): IdleTimeoutControl & { readonly seconds: number[] } {
  const seconds: number[] = [];
  return {
    seconds,
    timeout: (_request, value) => {
      seconds.push(value);
    },
  };
}

/** Yields across a turn of the loop, as real model output does — nothing here arrives synchronously. */
async function* chunksOf(...values: readonly string[]): AsyncGenerator<string> {
  for (const value of values) {
    await Bun.sleep(0);
    yield value;
  }
}

test("the idle timeout is disabled for the stream, and only for the stream", async () => {
  const server = recorder();
  const request = new Request("http://localhost/stream");

  await streamedOutput(request, server, chunksOf("hello")).text();

  // Bun.serve closes a connection after 10s of inactivity and counts a response that has not
  // written bytes as inactive, so a model that pauses to think looks idle and the browser sees a
  // reset mid-answer. Without this call the stream works in every fast test and breaks in
  // production, which is the worst shape a bug can have.
  expect(server.seconds).toEqual([0]);
});

test("the stream is an event stream, said out loud", () => {
  const response = streamedOutput(new Request("http://localhost/stream"), recorder(), chunksOf());

  expect(response.headers.get("content-type")).toBe("text/event-stream");
  expect(response.headers.get("cache-control")).toBe("no-cache");
});

test("chunks arrive as separate events, in order", async () => {
  const body = await streamedOutput(
    new Request("http://localhost/stream"),
    recorder(),
    chunksOf("The invoice ", "totals "),
  ).text();

  expect(body).toBe("data: The invoice \n\ndata: totals \n\n");
});

test("a line break inside a chunk does not end the event", () => {
  // Every one of the three break forms ends a record in the SSE grammar. An unescaped one splits
  // the payload into two events and the client renders the remainder as unrelated output — silently,
  // because nothing on either side reports an error.
  for (const separator of ["\n", "\r", "\r\n"]) {
    expect(streamEvent(`first${separator}second`)).toBe("data: first\ndata: second\n\n");
  }
});

test("an empty chunk is still a well-formed event", () => {
  expect(streamEvent("")).toBe("data: \n\n");
});
