import { expect, test } from "bun:test";
import { chargeBudget } from "@custodian/serving";

test("a charge within the ceiling returns the new running total", () => {
  expect(chargeBudget(1_000, 250, 5_000)).toEqual({ ok: true, value: 1_250 });
});

test("a charge that would breach the ceiling is refused, not clamped", () => {
  expect(chargeBudget(4_900, 250, 5_000)).toEqual({
    ok: false,
    error: { kind: "budget-exhausted", spent: 4_900, requested: 250, ceiling: 5_000 },
  });
});

test("landing exactly on the ceiling is allowed", () => {
  expect(chargeBudget(4_750, 250, 5_000)).toEqual({ ok: true, value: 5_000 });
});
