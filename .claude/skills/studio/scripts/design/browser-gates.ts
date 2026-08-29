#!/usr/bin/env bun
/**
 * browser-gates.ts — mechanical slop-gate verification in a real browser.
 *
 * Loads the emitted artifact in headless Chromium (via the cdp-headless skill)
 * and measures the layout/computed-style gates with Web APIs — getComputedStyle,
 * scrollWidth, getBoundingClientRect, CSSOM — instead of imagining the render.
 * Colors are read RESOLVED from the engine, so contrast runs on exactly what ships.
 *
 * Gates measured (numbers match knowledge/playbooks/slop-test.md):
 *   36 horizontal scroll · 62 overflow-x clip · 59 two-line clickable text
 *   38 unaligned interactive bars · 43 input/button height mismatch
 *   61 1fr image tracks · 63 display-head word wrap · 67 all-caps line-height
 *   68 double sticky top:0 · 54 hero padding asymmetry · 39 font-family count
 *   29 reduced-motion coverage · 46-48 rendered text contrast
 *
 * Usage:
 *   bun browser-gates.ts <artifact.html | file://...> [--widths 320,375,414,768,1280,1920] [--min-ratio 4.5]
 *
 * Exit: 0 all hard gates pass · 3 gate failures (stderr lists them) · 1 IO/browser error · 2 bad args.
 */

import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir, tmpdir } from "node:os";
import GATE_JS from "../../lib/page-scripts/gate-checks.js" with { type: "text" };

const CDP = join(homedir(), ".claude", "skills", "cdp-headless", "scripts");

const argv = Bun.argv.slice(2);
let target: string | undefined;
let widths = [320, 375, 414, 768, 1280, 1920];
let minRatio = 4.5;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--widths") {
    widths = argv[++i].split(",").map(Number);
    if (widths.some(w => !Number.isFinite(w) || w < 200)) { console.error("--widths must be numbers ≥200"); process.exit(2); }
  } else if (a === "--min-ratio") {
    minRatio = Number(argv[++i]);
    if (!Number.isFinite(minRatio)) { console.error("--min-ratio must be a number"); process.exit(2); }
  } else if (a === "-h" || a === "--help") {
    console.log("Usage: bun browser-gates.ts <artifact.html|file://...> [--widths 320,375,...] [--min-ratio 4.5]");
    process.exit(0);
  } else if (!a.startsWith("--")) target = a;
}
if (!target) { console.error("artifact path or file:// URL required"); process.exit(2); }
const url = target.startsWith("file://") || target.startsWith("http") ? target : `file://${resolve(target)}`;
if (url.startsWith("file://") && !existsSync(url.slice(7))) { console.error(`Not found: ${url.slice(7)}`); process.exit(1); }

function run(script: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["bun", join(CDP, script), ...args], { stdout: "pipe", stderr: "pipe" });
  return {
    ok: proc.exitCode === 0,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
}

// ---- in-page gate checker: pure MDN Web APIs, evaluated per viewport width ----

// ---- drive the browser ----
const tmp = mkdtempSync(join(tmpdir(), "studio-gates-"));
const gateFile = join(tmp, "gates.js");
writeFileSync(gateFile, GATE_JS.replace("__MIN_RATIO__", String(minRatio)));

try {
  let r = run("launch.ts", ["start"]);
  if (!r.ok) { console.error(`browser launch failed: ${r.stderr.trim()}`); process.exit(1); }
  r = run("navigate.ts", [url, "--wait=load"]);
  if (!r.ok) { console.error(`navigate failed: ${r.stderr.trim()}`); process.exit(1); }

  const perWidth: any[] = [];
  for (const w of widths) {
    run("send.ts", ["Emulation.setDeviceMetricsOverride", "--params", JSON.stringify({ mobile: w < 768, width: w, height: 900, deviceScaleFactor: 1 })]);
    r = run("eval.ts", ["--file", gateFile]);
    if (!r.ok) { console.error(`eval failed at ${w}px: ${r.stderr.trim() || r.stdout.trim()}`); process.exit(1); }
    let value: any;
    try {
      const parsed = JSON.parse(r.stdout);
      value = parsed.result ?? parsed.value ?? parsed;
    } catch { value = { fails: [{ gate: 0, detail: `unparseable eval output: ${r.stdout.slice(0, 200)}` }] }; }
    perWidth.push({ width: w, fails: value.fails ?? [] });
  }
  run("send.ts", ["Emulation.clearDeviceMetricsOverride", "--params", "{}"]);

  const allFails = perWidth.flatMap(p => p.fails.map((f: any) => ({ width: p.width, ...f })));
  const gatesHit = [...new Set(allFails.map(f => f.gate))].sort((a, b) => a - b);
  const out = JSON.stringify({ ok: allFails.length === 0, url, widths, gates_failed: gatesHit, failures: allFails }, null, 2);
  if (allFails.length > 0) { console.error(out); process.exit(3); }
  console.log(out);
  process.exit(0);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
