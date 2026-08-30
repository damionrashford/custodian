import { parseModelSnapshot } from "@custodian/domain-primitives";
import { expect, test } from "bun:test";

import { priceCompletion, replayUsageLog, type PriceTable } from "@custodian/metering";

function model(value: string) {
  const parsed = parseModelSnapshot(value);
  if (!parsed.ok) throw new Error(`fixture: bad model ${value}`);
  return parsed.value;
}

const FRONTIER = model("frontier-1.5-20260801");
const SMALL = model("small-1.0-20260801");

const TABLE: PriceTable = new Map([
  [FRONTIER, { inputMicrosPerToken: 3, outputMicrosPerToken: 15 }],
  [SMALL, { inputMicrosPerToken: 1, outputMicrosPerToken: 4 }],
]);

test("cost is input tokens times input price plus output tokens times output price", () => {
  expect(priceCompletion({ inputTokens: 1_000, outputTokens: 200 }, FRONTIER, TABLE)).toEqual({
    ok: true,
    value: 1_000 * 3 + 200 * 15,
  });
});

test("the same inputs always produce the same cost", () => {
  const usage = { inputTokens: 731, outputTokens: 97 };
  expect(priceCompletion(usage, SMALL, TABLE)).toEqual(priceCompletion(usage, SMALL, TABLE));
});

test("an unpriced model is an error, not a silent zero", () => {
  const unknown = model("mystery-9.9-20261231");
  expect(priceCompletion({ inputTokens: 10, outputTokens: 10 }, unknown, TABLE)).toEqual({
    ok: false,
    error: { kind: "unpriced-model", model: unknown },
  });
});

test("a whole billing period recomputes offline from the raw usage log", () => {
  expect(
    replayUsageLog(
      [
        { model: FRONTIER, usage: { inputTokens: 1_000, outputTokens: 200 } },
        { model: SMALL, usage: { inputTokens: 5_000, outputTokens: 900 } },
      ],
      TABLE,
    ),
  ).toEqual({ ok: true, value: 1_000 * 3 + 200 * 15 + (5_000 * 1 + 900 * 4) });
});

test("one unpriced record fails the whole replay rather than under-reporting", () => {
  const replayed = replayUsageLog(
    [{ model: model("mystery-9.9-20261231"), usage: { inputTokens: 1, outputTokens: 1 } }],
    TABLE,
  );
  expect(replayed.ok).toBe(false);
});
