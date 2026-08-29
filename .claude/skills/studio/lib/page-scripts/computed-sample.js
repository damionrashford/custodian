(async () => {
  await document.fonts?.ready;
  const els = Array.from(document.querySelectorAll("body, body *")).slice(0, 500);
  const root = getComputedStyle(document.documentElement);
  const allProps = ["color", "background-color", "border-color", "font-family", "font-size", "padding", "margin", "border-radius", "box-shadow", "transition-duration"];
  const rootProps = {};
  for (let i = 0; i < root.length; i++) {
    const name = root[i];
    if (name.startsWith("--")) rootProps[name] = root.getPropertyValue(name).trim();
  }
  const elStyles = els.map(el => {
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of allProps) o[p] = cs.getPropertyValue(p);
    return o;
  });
  return { rootProps, elStyles };
})()
