(async () => {
    const all = Array.from(document.querySelectorAll("button, a, [role='tab']"));
    const target = all.find(el => el.textContent?.trim() === "DESIGN.md");
    const clicked = Boolean(target);
    if (target) { target.click(); await new Promise(r => setTimeout(r, 2500)); }
    else { await new Promise(r => setTimeout(r, 1500)); }
    return { clicked, text: document.body.innerText };
  })()
