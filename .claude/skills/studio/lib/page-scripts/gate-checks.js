(() => {
  const fails = [];
  const note = (gate, detail) => fails.push({ gate, detail });
  const cs = el => getComputedStyle(el);
  const doc = document.documentElement;

  // 36 — horizontal scroll
  if (doc.scrollWidth > doc.clientWidth + 1) note(36, "document scrollWidth " + doc.scrollWidth + " > viewport " + doc.clientWidth);

  // 62 — overflow-x clip on html + body
  for (const el of [doc, document.body]) {
    const ox = cs(el).overflowX;
    if (ox !== "clip" && ox !== "hidden") { note(62, el.tagName.toLowerCase() + " overflow-x is '" + ox + "' (want clip)"); break; }
  }

  // 59 — two-line clickable text
  for (const el of document.querySelectorAll("a, button, [role=button], summary")) {
    const t = (el.textContent || "").trim();
    if (!t || el.querySelector("img,svg,picture")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const lh = parseFloat(cs(el).lineHeight) || parseFloat(cs(el).fontSize) * 1.4;
    if (r.height > lh * 1.9) note(59, "'" + t.slice(0, 40) + "' wraps (h=" + Math.round(r.height) + ", lh=" + Math.round(lh) + ")");
  }

  // 38 — interactive bars not vertically centered (child height spread in flex rows)
  for (const bar of document.querySelectorAll("nav, [role=toolbar], header")) {
    const s = cs(bar);
    if (s.display.includes("flex") && s.flexDirection.startsWith("row") && (s.alignItems === "stretch" || s.alignItems === "normal")) {
      const kids = [...bar.children].filter(k => k.getBoundingClientRect().height > 0);
      if (kids.length >= 2) {
        const hs = kids.map(k => k.getBoundingClientRect().height);
        if (Math.max(...hs) - Math.min(...hs) > 6) note(38, bar.tagName.toLowerCase() + " flex row uses align-items:stretch with mixed child heights");
      }
    }
  }

  // 43 — input height ≠ adjacent submit height in the same form
  for (const form of document.querySelectorAll("form")) {
    const input = form.querySelector("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select");
    const btn = form.querySelector("button, input[type=submit]");
    if (input && btn) {
      const hi = input.getBoundingClientRect().height, hb = btn.getBoundingClientRect().height;
      if (hi > 0 && hb > 0 && Math.abs(hi - hb) > 2) note(43, "form input " + Math.round(hi) + "px vs button " + Math.round(hb) + "px");
    }
  }

  // 61 — grid track '1fr' (not minmax(0,1fr)) containing images
  for (const el of document.querySelectorAll("*")) {
    const s = cs(el);
    if (s.display.includes("grid")) {
      const tpl = s.gridTemplateColumns + " " + s.gridTemplateRows;
      // computed values resolve fr; inspect the author value via inline/sheet is unreliable — use scroll overflow as proxy handled by gate 36; here check authored style attr only
      const authored = (el.getAttribute("style") || "");
      if (/(^|[^(,\s])1fr/.test(authored) && !/minmax\(\s*0/.test(authored) && el.querySelector("img, picture, video")) {
        note(61, "grid with plain 1fr track contains media: " + (el.className || el.tagName));
      }
    }
  }

  // 63 — display-size heads without overflow-wrap:anywhere
  for (const el of document.querySelectorAll("h1, h2, .hero__display, .section__title")) {
    const s = cs(el);
    if (parseFloat(s.fontSize) >= 36) {
      if (s.overflowWrap !== "anywhere" && s.wordBreak !== "break-word") {
        note(63, el.tagName.toLowerCase() + "." + (el.className || "") + " display head lacks overflow-wrap:anywhere");
      }
    }
  }

  // 67 — uppercase display heads with line-height < 1.0
  for (const el of document.querySelectorAll("h1, h2, .hero__display, .section__title")) {
    const s = cs(el);
    const fs = parseFloat(s.fontSize), lh = parseFloat(s.lineHeight);
    if (s.textTransform === "uppercase" && fs >= 32 && Number.isFinite(lh) && lh / fs < 0.995) {
      note(67, el.tagName.toLowerCase() + " uppercase at line-height " + (lh / fs).toFixed(2));
    }
  }

  // 68 — two sticky/fixed elements pinned at top:0
  let topStickies = 0;
  for (const el of document.querySelectorAll("*")) {
    const s = cs(el);
    if ((s.position === "sticky" || s.position === "fixed") && parseFloat(s.top) === 0) topStickies++;
  }
  if (topStickies > 1) note(68, topStickies + " elements sticky/fixed at top:0 (nav bleed)");

  // 54 — hero padding asymmetry (first section-ish block after nav)
  const hero = document.querySelector("main > section, main > header, body > section, .hero, [class*=hero]");
  if (hero) {
    const s = cs(hero);
    const pt = parseFloat(s.paddingTop), pb = parseFloat(s.paddingBottom);
    if (pt > 24 && pb < pt * 1.05) note(54, "hero padding-top " + pt + " ≥ padding-bottom " + pb + " (want bottom ≥ 1.3× top)");
  }

  // 39 — >3 distinct font families in use
  const fams = new Set();
  for (const el of document.querySelectorAll("body, body *")) {
    if (!(el.textContent || "").trim()) continue;
    const fam = cs(el).fontFamily.split(",")[0].trim().replace(/["']/g, "").toLowerCase();
    if (fam) fams.add(fam);
  }
  if (fams.size > 3) note(39, [...fams].join(", ") + " (" + fams.size + " families, ceiling 3)");

  // 29 — motion without prefers-reduced-motion coverage
  let hasMotion = false, hasPRM = false;
  try {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      for (const r of rules) {
        const t = r.cssText || "";
        if (/@keyframes|animation:|transition:/.test(t)) hasMotion = true;
        if (/prefers-reduced-motion/.test(t)) hasPRM = true;
      }
    }
  } catch {}
  if (hasMotion && !hasPRM) note(29, "animations/transitions present with no prefers-reduced-motion fallback");

  // 46-48 — rendered text contrast (resolved sRGB from the engine)
  const parseRGB = c => { const m = c.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); const [h, l] = la > lb ? [la, lb] : [lb, la]; return (h + 0.05) / (l + 0.05); };
  const effBg = el => {
    let n = el;
    while (n && n !== document) {
      const c = parseRGB(cs(n).backgroundColor);
      if (c && c.a >= 0.99) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const seen = new Set();
  const MIN = __MIN_RATIO__;
  for (const el of document.querySelectorAll("body *")) {
    const txt = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (!txt) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = cs(el);
    const fg = parseRGB(s.color);
    if (!fg) continue;
    const bg = effBg(el);
    const fs = parseFloat(s.fontSize), bold = parseInt(s.fontWeight) >= 700;
    const large = fs >= 24 || (fs >= 18.66 && bold);
    const min = large ? 3.0 : MIN;
    const rr = ratio(fg, bg);
    const key = s.color + "/" + JSON.stringify(bg) + "/" + min;
    if (rr < min && !seen.has(key)) {
      seen.add(key);
      note(large ? 47 : 46, "'" + (el.textContent || "").trim().slice(0, 30) + "' " + rr.toFixed(2) + ":1 (need " + min + ":1)");
    }
  }

  return { width: innerWidth, fails };
})()
