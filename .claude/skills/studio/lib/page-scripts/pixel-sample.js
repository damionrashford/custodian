(async () => {
  const img = new Image();
  img.src = "__DATA_URL__";
  await img.decode();
  const scale = Math.min(1, 100 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const cv = new OffscreenCanvas(w, h);
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const px = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  return { w, h, px };
})()
