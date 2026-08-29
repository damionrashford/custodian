import { test, expect } from "bun:test";
import { colorMath } from "../lib/colormath.ts";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "scripts", "design", "color-math.py");

test("color-math.py selftest passes all reference vectors", () => {
  const proc = Bun.spawnSync(["uv", "run", "--quiet", SCRIPT, "selftest"], { stdout: "pipe", stderr: "pipe" });
  expect(proc.exitCode).toBe(0);
});

test("contrast: white/black is exactly 21, canonical pair matches coloraide", () => {
  const { results } = colorMath("contrast", { pairs: [
    { name: "wb", fg: "white", bg: "black", min: 4.5 },
    { name: "pair", fg: "oklch(30% 0.02 270)", bg: "oklch(98% 0.005 90)", min: 4.5 },
  ]});
  expect(results[0].ratio).toBeCloseTo(21.0, 1);
  expect(results[1].ratio).toBeCloseTo(12.89, 1);
  expect(results[1].pass).toBe(true);
});

test("contrast: unparseable colors report error, never a fake ratio", () => {
  const { results } = colorMath("contrast", { pairs: [{ name: "x", fg: "junk", bg: "white", min: 4.5 }] });
  expect(results[0].error).toBe("unparseable");
  expect(results[0].ratio).toBeUndefined();
});

test("derive: light mode cascades hover/active/disabled/fg and a ≥3:1 ring", () => {
  const d = colorMath("derive", { colors: [
    { role: "bg", value: "oklch(98% 0.005 90)" },
    { role: "fg", value: "oklch(25% 0.02 270)" },
    { role: "primary", value: "oklch(55% 0.18 260)" },
    { role: "accent", value: "oklch(70% 0.15 40)" },
  ], mode: "auto" });
  expect(d.mode).toBe("light");
  const roles = new Set(d.derived.map(x => x.role));
  for (const r of ["primary-hover", "primary-active", "primary-disabled", "primary-fg", "ring", "border", "muted-fg"]) {
    expect(roles.has(r)).toBe(true);
  }
  const ring = d.derived.find(x => x.role === "ring")!;
  const check = colorMath("contrast", { pairs: [{ name: "r", fg: ring.value, bg: "oklch(98% 0.005 90)", min: 3.0 }] });
  expect(check.results[0].pass).toBe(true);
});

test("derive: dark mode detected from dark bg", () => {
  const d = colorMath("derive", { colors: [
    { role: "bg", value: "oklch(16% 0.02 260)" },
    { role: "fg", value: "oklch(93% 0.01 260)" },
    { role: "primary", value: "oklch(62% 0.17 275)" },
  ], mode: "auto" });
  expect(d.mode).toBe("dark");
});

test("centroid: batched groups, circular hue", () => {
  const { groups } = colorMath("centroid", { groups: [
    { name: "wrap", points: [{ value: "oklch(60% 0.2 350)", weight: 1 }, { value: "oklch(60% 0.2 10)", weight: 1 }] },
  ]});
  const h = parseFloat(groups[0].value!.match(/ ([\d.]+)\)$/)![1]);
  expect(h < 20 || h > 340).toBe(true);
});

test("deltae: CIEDE2000 on the standard 0-100 scale", () => {
  const { results } = colorMath("deltae", { pairs: [
    { a: "red", b: "blue" },
    { a: "#ff0000", b: "#fe0000" },
  ]});
  expect(results[0].delta!).toBeGreaterThan(20);
  expect(results[1].delta!).toBeLessThan(1);
});
