/**
 * colormath.ts — bridge to scripts/design/color-math.py (coloraide).
 *
 * All WCAG / OKLCH / ΔE / centroid math routes through the Python authority
 * so the numbers come from a maintained color library, not hand-rolled TS.
 * One subprocess per batch call; requires `uv` on PATH (cached env, ~100ms warm).
 */

import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "scripts", "design", "color-math.py");

export interface ContrastResult {
  name: string;
  ratio?: number;
  min?: number;
  pass?: boolean;
  fg_hex?: string;
  bg_hex?: string;
  error?: string;
  value?: string;
}

export interface DeriveResult {
  mode: "light" | "dark";
  derived: Array<{ role: string; value: string }>;
}

export function colorMath(op: "contrast", payload: { pairs: Array<{ name: string; fg: string; bg: string; min: number }> }): { results: ContrastResult[] };
export function colorMath(op: "derive", payload: { colors: Array<{ role: string; value: string }>; mode?: string }): DeriveResult;
export function colorMath(op: "centroid", payload: { points: Array<{ value: string; weight: number }> }): { value?: string; hex?: string; error?: string };
export function colorMath(op: "centroid", payload: { groups: Array<{ name: string; points: Array<{ value: string; weight: number }> }> }): { groups: Array<{ name: string; value?: string; hex?: string; error?: string }> };
export function colorMath(op: "deltae", payload: { pairs: Array<{ a: string; b: string }> }): { results: Array<{ delta?: number; error?: string }> };
export function colorMath(op: "convert", payload: { values: string[] }): { results: Array<{ input: string; oklch?: string; hex?: string; L?: number; C?: number; H?: number; error?: string }> };
export function colorMath(op: string, payload: unknown): unknown {
  const proc = Bun.spawnSync(["uv", "run", "--quiet", SCRIPT, op], {
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    const err = new TextDecoder().decode(proc.stderr).trim();
    throw new Error(`color-math.py ${op} failed (exit ${proc.exitCode}): ${err || "no stderr"}. Is uv installed? (curl -LsSf https://astral.sh/uv/install.sh | sh — inspect before running)`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout));
}
