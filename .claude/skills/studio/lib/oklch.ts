#!/usr/bin/env bun
/**
 * oklch.ts — Color math: hex ↔ OKLCH, k-means clustering in OKLCH space.
 *
 * Subcommands:
 *   to-oklch  '#hex'                       → JSON { L, C, H }
 *   to-hex    'oklch(L C H)'               → '#hex'
 *   cluster   --k <auto|N> --output <path> [--provenance <string>]
 *             Reads a JSON array of hex strings from stdin, k-means clusters,
 *             writes a brand-draft skeleton with the cluster centroids as colors.
 *
 * No deps — pure-TS OKLCH transform inlined. Shared by extract-url and from-moodboard.
 */

// ---------- OKLCH math ----------
function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lr = Math.cbrt(l), mr = Math.cbrt(m), sr = Math.cbrt(s);
  return [
    0.2104542553 * lr + 0.793617785 * mr - 0.0040720468 * sr,
    1.9779984951 * lr - 2.428592205 * mr + 0.4505937099 * sr,
    0.0259040371 * lr + 0.7827717662 * mr - 0.808675766 * sr
  ];
}
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const lr = L + 0.3963377774 * a + 0.2158037573 * b;
  const mr = L - 0.1055613458 * a - 0.0638541728 * b;
  const sr = L - 0.0894841775 * a - 1.291485548 * b;
  const l = lr ** 3, m = mr ** 3, s = sr ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
}

function hexToOklch(hex: string): { L: number; C: number; H: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const [L, a, B] = linearToOklab(lr, lg, lb);
  const C = Math.sqrt(a * a + B * B);
  let H = (Math.atan2(B, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function oklchToHex(L: number, C: number, H: number): string {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const [lr, lg, lb] = oklabToLinear(L, a, b);
  const [r, g, B] = [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
  return "#" + [r, g, B].map((c) => c.toString(16).padStart(2, "0")).join("");
}

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff", black: "#000000", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", orange: "#ffa500", purple: "#800080", gray: "#808080", grey: "#808080",
  silver: "#c0c0c0", maroon: "#800000", navy: "#000080", teal: "#008080", olive: "#808000",
  aqua: "#00ffff", cyan: "#00ffff", fuchsia: "#ff00ff", magenta: "#ff00ff", lime: "#00ff00",
  whitesmoke: "#f5f5f5", gainsboro: "#dcdcdc", lightgray: "#d3d3d3", darkgray: "#a9a9a9",
  dimgray: "#696969", slategray: "#708090", rebeccapurple: "#663399", transparent: "#00000000"
};

function hslToRgb(h: number, sPct: number, lPct: number): [number, number, number] {
  const sN = sPct / 100, lN = lPct / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lN - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function parseColorToHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  // Bun.color is a full CSS Color 4 parser (hex/rgb/hsl/hwb/lab/lch/oklab/oklch-%/
  // named/color-mix) at native speed — try it first. It returns null for unitless-L
  // oklch and 8-digit alpha nuances, which the fallbacks below still cover.
  const native = Bun.color(v, "hex");
  if (native) return native.length > 7 ? native.slice(0, 7) : native;
  if (v.startsWith("#")) {
    const h = v.slice(1);
    if (/^[0-9a-f]{3}$/.test(h)) return "#" + h.split("").map(c => c + c).join("");
    if (/^[0-9a-f]{4}$/.test(h)) return "#" + h.slice(0, 3).split("").map(c => c + c).join("");
    if (/^[0-9a-f]{6}$/.test(h)) return v;
    if (/^[0-9a-f]{8}$/.test(h)) return "#" + h.slice(0, 6);
    return null;
  }
  // oklch(L C H [/ a]) — L as percent (98%) or unitless 0-1; hue may carry "deg"
  const ok = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.%]+)?\s*\)/);
  if (ok) {
    let L = parseFloat(ok[1]);
    if (ok[2] === "%" || L > 1) L /= 100;
    return oklchToHex(L, parseFloat(ok[3]), parseFloat(ok[4]));
  }
  const rgb = v.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/);
  if (rgb) return "#" + [+rgb[1], +rgb[2], +rgb[3]].map(c => Math.round(c).toString(16).padStart(2, "0")).join("");
  const hsl = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/);
  if (hsl) {
    const [r, g, b] = hslToRgb(parseFloat(hsl[1]), parseFloat(hsl[2]), parseFloat(hsl[3]));
    return "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");
  }
  if (NAMED_COLORS[v]) return NAMED_COLORS[v].slice(0, 7);
  return null;
}

/** Canonical CSS emit form: oklch(55.0% 0.15 250.0). The skill's OKLCH-only invariant. */
function oklchToCss(L: number, C: number, H: number): string {
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(4)} ${(((H % 360) + 360) % 360).toFixed(1)})`;
}

function deltaE(a: { L: number; C: number; H: number }, b: { L: number; C: number; H: number }): number {
  const dL = a.L - b.L;
  const dC = a.C - b.C;
  const ah = (a.H * Math.PI) / 180, bh = (b.H * Math.PI) / 180;
  const dH = Math.sqrt(2 * a.C * b.C * (1 - Math.cos(ah - bh)));
  return Math.sqrt(dL * dL + dC * dC + dH * dH);
}

// ---------- k-means in OKLCH space ----------
function kmeans(points: { L: number; C: number; H: number }[], k: number, iters = 50) {
  // k-means++ style seeding to avoid first-K-points pathology
  const centroids: { L: number; C: number; H: number }[] = [];
  if (points.length === 0) return { centroids, assignments: [], sizes: [] };
  centroids.push({ ...points[Math.floor(points.length / 2)] });
  while (centroids.length < k && centroids.length < points.length) {
    const dists = points.map(p => Math.min(...centroids.map(c => deltaE(p, c))));
    const total = dists.reduce((s, d) => s + d * d, 0);
    if (total === 0) break;
    let r = Math.random() * total;
    let chosen = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i] * dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroids.push({ ...points[chosen] });
  }
  while (centroids.length < k) centroids.push({ ...points[centroids.length % points.length] });

  const assignments = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const d = deltaE(points[i], centroids[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    for (let j = 0; j < k; j++) {
      const members = points.filter((_, i) => assignments[i] === j);
      if (members.length === 0) continue;
      // hue is circular — average in Cartesian a/b space, never linearly
      const mL = members.reduce((s, p) => s + p.L, 0) / members.length;
      const mA = members.reduce((s, p) => s + p.C * Math.cos((p.H * Math.PI) / 180), 0) / members.length;
      const mB = members.reduce((s, p) => s + p.C * Math.sin((p.H * Math.PI) / 180), 0) / members.length;
      let mH = (Math.atan2(mB, mA) * 180) / Math.PI;
      if (mH < 0) mH += 360;
      centroids[j] = { L: mL, C: Math.sqrt(mA * mA + mB * mB), H: mH };
    }
    if (!changed) break;
  }
  const sizes = centroids.map((_, j) => assignments.filter((a) => a === j).length);
  return { centroids, assignments, sizes };
}

/**
 * Elbow heuristic: keep the highest k whose marginal WCSS drop is meaningful
 * (>50% of the largest drop observed). Bounded by [min, max] AND points.length.
 */
function chooseK(points: { L: number; C: number; H: number }[], min = 3, max = 8): number {
  const effectiveMax = Math.min(max, points.length);
  if (effectiveMax <= min) return Math.max(1, Math.min(min, points.length));

  let prevWcss: number | null = null;
  const drops: number[] = [];
  const ks: number[] = [];
  for (let k = min; k <= effectiveMax; k++) {
    const { centroids, assignments } = kmeans(points, k, 30);
    const wcss = points.reduce((s, p, i) => s + deltaE(p, centroids[assignments[i]]) ** 2, 0);
    if (prevWcss !== null) {
      drops.push(prevWcss - wcss);
      ks.push(k);
    }
    prevWcss = wcss;
  }
  if (drops.length === 0) return min;
  const maxDrop = Math.max(...drops, 0);
  let bestK = min;
  for (let i = 0; i < drops.length; i++) {
    if (drops[i] > maxDrop * 0.5) bestK = ks[i];
    else break;
  }
  return bestK;
}

/**
 * Assign color roles from clustered centroids. bg = the DOMINANT cluster (most
 * page area / most declarations), not the lightest — dark themes stay dark.
 * fg = the cluster with max lightness distance from bg. Rest by size.
 */
function assignColorRoles(clusters: Array<{ c: { L: number; C: number; H: number }; size: number }>): Array<{ role: string; c: { L: number; C: number; H: number }; size: number }> {
  if (clusters.length === 0) return [];
  const bySize = [...clusters].sort((a, b) => b.size - a.size);
  const bg = bySize[0];
  const rest = bySize.slice(1);
  let fgIdx = -1, fgDist = -1;
  for (let i = 0; i < rest.length; i++) {
    const d = Math.abs(rest[i].c.L - bg.c.L);
    if (d > fgDist) { fgDist = d; fgIdx = i; }
  }
  const out: Array<{ role: string; c: { L: number; C: number; H: number }; size: number }> = [{ role: "bg", ...bg }];
  const restRoles = ["primary", "accent", "muted", "destructive", "success"];
  let r = 0;
  for (let i = 0; i < rest.length; i++) {
    if (i === fgIdx) { out.push({ role: "fg", ...rest[i] }); continue; }
    out.push({ role: restRoles[r] ?? `extra-${r}`, ...rest[i] });
    r++;
  }
  return out;
}

export { hexToOklch, oklchToHex, oklchToCss, deltaE, kmeans, chooseK, parseColorToHex, assignColorRoles };

if (import.meta.main) {
  await runCli();
}

async function runCli() {
const argv = Bun.argv.slice(2);
const sub = argv[0];

if (sub === "to-oklch") {
  const hex = argv[1];
  if (!hex) { console.error("Usage: oklch.ts to-oklch '#RRGGBB'"); process.exit(2); }
  const o = hexToOklch(hex);
  console.log(JSON.stringify(o));
  process.exit(0);
}

if (sub === "to-hex") {
  const m = argv[1]?.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/);
  if (!m) { console.error("Usage: oklch.ts to-hex 'oklch(L C H)'"); process.exit(2); }
  console.log(oklchToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])));
  process.exit(0);
}

if (sub === "cluster") {
  let k: string = "auto", outPath = "", provenance = "moodboard";
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--k") k = argv[++i];
    else if (argv[i] === "--output") outPath = argv[++i];
    else if (argv[i] === "--provenance") provenance = argv[++i];
  }
  if (!outPath) { console.error("--output required"); process.exit(2); }

  const stdin = await Bun.stdin.text();
  let hexes: string[];
  try { hexes = JSON.parse(stdin); } catch { console.error("stdin must be JSON array of hex strings"); process.exit(2); }
  if (!Array.isArray(hexes) || hexes.length < 3) { console.error("need ≥3 hex inputs"); process.exit(2); }

  // Normalize hex inputs (handle #fff → #ffffff, #rrggbbaa → #rrggbb)
  const normalized = hexes.map(h => parseColorToHex(h)).filter((h): h is string => h !== null);
  if (normalized.length < 3) { console.error("need ≥3 parseable hex inputs"); process.exit(2); }

  const points = normalized.map(hexToOklch);
  const requestedK = k === "auto" ? chooseK(points) : parseInt(k, 10);
  const K = Math.max(1, Math.min(requestedK, points.length));
  const { centroids, sizes } = kmeans(points, K, 50);

  const assigned = assignColorRoles(centroids.map((c, i) => ({ c, size: sizes[i] })));
  const now = new Date().toISOString();
  const draft = {
    $schema: "https://github.com/damionrashford/design-system/schema/0.2.0",
    schema_version: "0.2.0",
    source_url: null,
    fetched_at: now,
    updated_at: now,
    tokens: {
      color: assigned.map(s => ({
        name: s.role,
        value: oklchToCss(s.c.L, s.c.C, s.c.H),
        category: "color",
        role: s.role,
        provenance: {
          source_type: "moodboard",
          source_url: null,
          source_selector: `kmeans cluster (size ${s.size}) ${provenance}`,
          extraction_mode: "fast",
          extracted_at: now,
          extractor_pass: "oklch-kmeans"
        },
        confidence: 0.5 + (s.size / normalized.length) * 0.4
      })),
      typography: [], spacing: [], text_scale: [], motion: [], depth: []
    },
    derived: { states: {}, contrast: [] },
    coverage_flags: { js_rendered: false, css_in_js_likely: false, theme_variants_found: [], responsive_variants_found: [] },
    confidence_global: 0.5,
    extraction_mode: "fast",
    history: [{ at: now, op: "extract", summary: `kmeans cluster of ${normalized.length} hex inputs → ${K} centroids` }]
  };

  await Bun.write(outPath, JSON.stringify(draft, null, 2));
  console.log(JSON.stringify({ ok: true, output: outPath, k: K, centroids: sorted.length }, null, 2));
  process.exit(0);
}

console.error("Usage: oklch.ts {to-oklch|to-hex|cluster} ...");
process.exit(2);
}
