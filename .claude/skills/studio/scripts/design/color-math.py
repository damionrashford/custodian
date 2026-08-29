# /// script
# requires-python = ">=3.11"
# dependencies = ["coloraide>=4.0"]
# ///
"""color-math.py — the single color-math authority for the studio skill.

Every WCAG ratio, OKLCH conversion, ΔE, state derivation, and weighted
centroid the TS scripts need routes through here (coloraide), so the math
is library-grade instead of hand-rolled. TS keeps file I/O and policy
wiring; this owns the numbers.

Usage:  uv run color-math.py <op>        (JSON on stdin, JSON on stdout)

Ops:
  contrast   {"pairs":[{"name","fg","bg","min"}]}
             -> {"results":[{"name","ratio","pass","fg_hex","bg_hex"}]}
             Unparseable colors -> {"name","error":"unparseable","value":...}
  derive     {"colors":[{"role","value"}], "mode":"auto|light|dark"}
             -> {"mode", "derived":[{"role","value"}]}
             Cascades hover/active/disabled/fg/ring from base roles.
  centroid   {"points":[{"value","weight"}]}
             -> {"value":"oklch(..)","hex":"#..."}   (hue-circular, in OKLab)
  deltae     {"pairs":[{"a","b"}]} -> {"results":[{"delta":..}]}  (CIEDE2000)
  convert    {"values":["any css color", ...]}
             -> {"results":[{"input","oklch","hex","L","C","H"} | {"input","error"}]}
  selftest   no stdin -> runs reference-vector assertions, exit 0/1

Exit: 0 ok · 1 internal/self-test failure · 2 bad args/stdin.
"""
from __future__ import annotations

import json
import sys

from coloraide import Color

WCAG = "wcag21"


def fmt_oklch(c: Color) -> str:
    ok = c.convert("oklch")
    L, C, H = ok["lightness"], ok["chroma"], ok["hue"]
    if H != H:  # NaN hue on achromatic colors
        H = 0.0
    return f"oklch({round(L * 100, 1)}% {round(C, 4)} {round(H % 360, 1)})"


def parse(value: str) -> Color | None:
    try:
        return Color(value)
    except Exception:
        return None


def contrast(fg: Color, bg: Color) -> float:
    # coloraide's wcag21 contrast is order-sensitive in name only; ratio is symmetric max/min luminance
    return round(fg.contrast(bg, method=WCAG), 4)


def op_contrast(payload: dict) -> dict:
    out = []
    for p in payload.get("pairs", []):
        fg, bg = parse(p.get("fg", "")), parse(p.get("bg", ""))
        if fg is None or bg is None:
            bad = p.get("fg") if fg is None else p.get("bg")
            out.append({"name": p.get("name"), "error": "unparseable", "value": bad})
            continue
        ratio = contrast(fg, bg)
        minimum = float(p.get("min", 4.5))
        out.append({
            "name": p.get("name"),
            "ratio": ratio,
            "min": minimum,
            "pass": ratio >= minimum,
            "fg_hex": fg.convert("srgb").fit().to_string(hex=True),
            "bg_hex": bg.convert("srgb").fit().to_string(hex=True),
        })
    return {"results": out}


def shift_l(c: Color, delta: float) -> Color:
    ok = c.convert("oklch").clone()
    ok["lightness"] = min(0.99, max(0.01, ok["lightness"] + delta))
    return ok


def scale_c(c: Color, factor: float) -> Color:
    ok = c.convert("oklch").clone()
    ok["chroma"] = max(0.0, ok["chroma"] * factor)
    return ok


def op_derive(payload: dict) -> dict:
    colors = {c["role"]: parse(c["value"]) for c in payload.get("colors", []) if parse(c.get("value", ""))}
    mode = payload.get("mode", "auto")
    bg = colors.get("bg") or colors.get("paper")
    if mode == "auto":
        mode = "light" if (bg is None or bg.convert("oklch")["lightness"] > 0.5) else "dark"
    direction = -1.0 if mode == "light" else 1.0

    derived: list[dict] = []

    def emit(role: str, c: Color) -> None:
        derived.append({"role": role, "value": fmt_oklch(c)})

    for base in ("primary", "accent", "destructive"):
        c = colors.get(base)
        if c is None:
            continue
        emit(f"{base}-hover", shift_l(c, 0.04 * direction))
        emit(f"{base}-active", shift_l(c, 0.08 * direction))
        emit(f"{base}-disabled", scale_c(shift_l(c, 0.02 * direction), 0.3))
        # foreground-on-fill: pick the candidate with the higher WCAG ratio
        cands = [x for x in (colors.get("bg"), colors.get("fg"), colors.get("paper"), colors.get("ink")) if x]
        if cands and f"{base}-fg" not in colors:
            best = max(cands, key=lambda k: contrast(k, c))
            emit(f"{base}-fg", best)

    fg = colors.get("fg") or colors.get("ink")
    if fg is not None and bg is not None and "muted-fg" not in colors:
        # muted-fg: pull fg 35% toward bg in OKLab (stays hue-true), floor at 4.5:1
        muted = Color(fg).mix(bg, 0.35, space="oklab")
        if contrast(muted, bg) < 4.5:
            muted = Color(fg).mix(bg, 0.2, space="oklab")
        emit("muted-fg", muted)
    if bg is not None and "border" not in colors and fg is not None:
        # hairline per depth.md R6 (8–15% fg into bg) — aesthetic, reported as advisory
        emit("border", Color(fg).mix(bg, 0.88, space="oklab"))
    ring_src = colors.get("focus") or colors.get("accent") or colors.get("primary")
    if ring_src is not None and bg is not None and "ring" not in colors:
        # focus ring MUST clear 3:1 vs bg (WCAG non-text contrast) — walk L away from bg until it does
        ring = Color(ring_src).convert("oklch").clone()
        step = -0.03 if mode == "light" else 0.03
        for _ in range(25):
            if contrast(ring, bg) >= 3.0:
                break
            ring["lightness"] = min(0.99, max(0.01, ring["lightness"] + step))
        emit("ring", ring)
    elif ring_src is not None and "ring" not in colors:
        emit("ring", ring_src)

    return {"mode": mode, "derived": derived}


def _centroid(points: list[dict]) -> dict:
    pts, weights = [], []
    for p in points:
        c = parse(p.get("value", ""))
        if c is None:
            continue
        pts.append(c.convert("oklab"))
        weights.append(float(p.get("weight", 0.5)))
    if not pts:
        return {"error": "no parseable points"}
    w = sum(weights)
    L = sum(c["lightness"] * k for c, k in zip(pts, weights)) / w
    a = sum(c["a"] * k for c, k in zip(pts, weights)) / w
    b = sum(c["b"] * k for c, k in zip(pts, weights)) / w
    out = Color("oklab", [L, a, b])
    return {"value": fmt_oklch(out), "hex": out.convert("srgb").fit().to_string(hex=True)}


def op_centroid(payload: dict) -> dict:
    if "groups" in payload:  # batch form: one subprocess for N role-groups
        return {"groups": [{"name": g.get("name"), **_centroid(g.get("points", []))}
                           for g in payload["groups"]]}
    return _centroid(payload.get("points", []))


def op_deltae(payload: dict) -> dict:
    out = []
    for p in payload.get("pairs", []):
        a, b = parse(p.get("a", "")), parse(p.get("b", ""))
        if a is None or b is None:
            out.append({"error": "unparseable"})
            continue
        out.append({"delta": round(a.delta_e(b, method="2000"), 3)})
    return {"results": out}


def op_convert(payload: dict) -> dict:
    out = []
    for v in payload.get("values", []):
        c = parse(v)
        if c is None:
            out.append({"input": v, "error": "unparseable"})
            continue
        ok = c.convert("oklch")
        h = ok["hue"]
        out.append({
            "input": v,
            "oklch": fmt_oklch(c),
            "hex": c.convert("srgb").fit().to_string(hex=True),
            "L": round(ok["lightness"], 4),
            "C": round(ok["chroma"], 4),
            "H": 0.0 if h != h else round(h % 360, 2),
        })
    return {"results": out}


def op_selftest() -> dict:
    checks = []

    def ck(name: str, cond: bool, detail: str = "") -> None:
        checks.append({"name": name, "pass": bool(cond), "detail": detail})

    r = contrast(Color("white"), Color("black"))
    ck("wcag white/black == 21", abs(r - 21.0) < 0.01, str(r))
    r = contrast(Color("#777777"), Color("white"))
    ck("wcag #777/white ≈ 4.48", abs(r - 4.48) < 0.05, str(r))
    c = parse("oklch(98% 0.005 90)")
    ck("percent-L oklch parses", c is not None and abs(c.convert("oklch")["lightness"] - 0.98) < 1e-6)
    c = parse("oklch(0.55 0.15 250)")
    ck("unitless-L oklch parses", c is not None and abs(c.convert("oklch")["lightness"] - 0.55) < 1e-6)
    cen = op_centroid({"points": [
        {"value": "oklch(60% 0.2 350)", "weight": 1},
        {"value": "oklch(60% 0.2 10)", "weight": 1},
    ]})
    hue = Color(cen["value"]).convert("oklch")["hue"] % 360
    ck("circular hue centroid 350+10 -> ~0", hue < 20 or hue > 340, cen["value"])
    d = op_deltae({"pairs": [{"a": "red", "b": "blue"}]})["results"][0]["delta"]
    ck("ΔE2000 red/blue is large (>20)", d > 20, str(d))
    d = op_deltae({"pairs": [{"a": "#ff0000", "b": "#fe0000"}]})["results"][0]["delta"]
    ck("ΔE2000 near-identical (<1)", d < 1, str(d))
    dv = op_derive({"colors": [
        {"role": "bg", "value": "oklch(98% 0.005 90)"},
        {"role": "fg", "value": "oklch(25% 0.02 270)"},
        {"role": "primary", "value": "oklch(55% 0.18 260)"},
    ], "mode": "auto"})
    roles = {d_["role"] for d_ in dv["derived"]}
    ck("derive emits hover/active/disabled/fg", {"primary-hover", "primary-active", "primary-disabled", "primary-fg"} <= roles, str(sorted(roles)))
    ck("derive mode detect light", dv["mode"] == "light")
    ok = all(c["pass"] for c in checks)
    return {"ok": ok, "checks": checks}


def main() -> int:
    if len(sys.argv) != 2:
        sys.stderr.write(__doc__ or "")
        return 2
    op = sys.argv[1]
    if op == "selftest":
        res = op_selftest()
        print(json.dumps(res, indent=2))
        return 0 if res["ok"] else 1
    try:
        payload = json.load(sys.stdin)
    except Exception as e:
        sys.stderr.write(f"bad stdin JSON: {e}\n")
        return 2
    ops = {"contrast": op_contrast, "derive": op_derive, "centroid": op_centroid,
           "deltae": op_deltae, "convert": op_convert}
    fn = ops.get(op)
    if fn is None:
        sys.stderr.write(f"unknown op '{op}'. ops: {', '.join(ops)}, selftest\n")
        return 2
    try:
        print(json.dumps(fn(payload)))
        return 0
    except Exception as e:
        sys.stderr.write(f"{op} failed: {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
