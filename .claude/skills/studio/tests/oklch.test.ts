import { test, expect, describe } from "bun:test";
import { parseColorToHex, oklchToCss, hexToOklch, kmeans, assignColorRoles } from "../lib/oklch.ts";

describe("parseColorToHex (Bun.color primary + fallbacks)", () => {
  const cases: Array<[string, string | null]> = [
    ["oklch(98% 0.005 90)", "#faf8f5"],
    ["oklch(0.55 0.15 250)", "#0f74c5"],   // unitless L — fallback path
    ["hsl(210, 50%, 40%)", "#336699"],
    ["rebeccapurple", "#663399"],
    ["lab(50% 40 59.5)", "#bf5700"],
    ["color-mix(in srgb, red, blue)", "#800080"],
    ["hwb(200 10% 10%)", "#1aa1e6"],
    ["#abc", "#aabbcc"],
    ["#aabbccdd", "#aabbcc"],
    ["rgb(51, 102, 153)", "#336699"],
    ["not-a-color", null],
  ];
  for (const [input, want] of cases) {
    test(`${input} → ${want}`, () => {
      expect(parseColorToHex(input)).toBe(want);
    });
  }
});

test("oklchToCss emits the canonical percent form", () => {
  expect(oklchToCss(0.55, 0.15, 250)).toBe("oklch(55.0% 0.1500 250.0)");
  expect(oklchToCss(0.7, 0.1501, 399.9 + 360)).toBe("oklch(70.0% 0.1501 39.9)");   // hue normalizes mod 360
});

test("hexToOklch ↔ parseColorToHex round-trip stays within ΔL 0.01", () => {
  const o = hexToOklch("#0f74c5");
  const back = parseColorToHex(oklchToCss(o.L, o.C, o.H))!;
  const o2 = hexToOklch(back);
  expect(Math.abs(o.L - o2.L)).toBeLessThan(0.01);
});

test("kmeans centroid averages hue circularly (350°+10° → ~0°, never 180°)", () => {
  const { centroids } = kmeans([{ L: 0.6, C: 0.2, H: 350 }, { L: 0.6, C: 0.2, H: 10 }], 1, 10);
  const h = centroids[0].H % 360;
  expect(h < 20 || h > 340).toBe(true);
});

test("assignColorRoles keeps dark themes dark (bg = dominant cluster, not lightest)", () => {
  const roles = assignColorRoles([
    { c: { L: 0.15, C: 0.02, H: 260 }, size: 900 },  // dominant dark surface
    { c: { L: 0.95, C: 0.01, H: 260 }, size: 100 },  // light text
    { c: { L: 0.60, C: 0.18, H: 30 }, size: 50 },
  ]);
  const byRole = Object.fromEntries(roles.map(r => [r.role, r.c]));
  expect(byRole.bg.L).toBeLessThan(0.5);
  expect(byRole.fg.L).toBeGreaterThan(0.5);
});
