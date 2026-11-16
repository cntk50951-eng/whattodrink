import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const root = path.resolve("public/intro-next/brand");
const read = (name) => readFile(path.join(root, name));
const save = (name, data) => writeFile(path.join(root, name), data);
const embed = (buffer) => `data:image/png;base64,${buffer.toString("base64")}`;
const logo = await read("approved-logo-original.png");
const light = await read("amber-light-v1.png");
const en = (await read("wordmark-en.svg")).toString();
const zh = (await read("wordmark-zh.svg")).toString();
const wordmark = (svg, x, y, width, height) => svg.replace("<svg ", `<svg x="${x}" y="${y}" width="${width}" height="${height}" color="#F4ECDD" `);

// Match the approved POC's drawImage source rectangle exactly; do not redraw h.
const icon = `<svg viewBox="0 0 320 332" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="icon"><rect width="320" height="332" rx="80"/></clipPath></defs><image href="${embed(logo)}" y="-6" width="320" height="348" clip-path="url(#icon)"/></svg>`;
await save("icon.svg", icon);
const art = `<defs><radialGradient id="fade" r="80%"><stop offset="30%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><mask id="edge"><rect width="1400" height="1400" fill="url(#fade)"/></mask><filter id="shadow" x="-70%" y="-70%" width="240%" height="240%"><feDropShadow dx="0" dy="22" stdDeviation="38" flood-color="#B87822" flood-opacity=".18"/></filter></defs>
<image href="${embed(light)}" width="1400" height="1400" opacity=".6" mask="url(#edge)"/>
<g filter="url(#shadow)">${icon.replace("<svg ", '<svg x="490" y="210" width="420" height="436" ')}</g>
${wordmark(en, 295, 748, 810, 182)}
${wordmark(zh, 580, 1020, 240, 106)}`;
const master = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 1400" role="img" aria-label="hi drink · 嗨飲"><title>hi drink · 嗨飲</title>${art}</svg>`;
await save("hi-drink-opening-v1.svg", master);
const png = new Resvg(master).render().asPng();
await save("hi-drink-opening-v1.png", png);
await save("hi-drink-opening-v1.webp", await sharp(png).webp({ quality: 92 }).toBuffer());
const preview = master.replace("<title>", '<rect width="1400" height="1400" fill="#090F14"/><title>');
await save("hi-drink-opening-preview-v1.png", new Resvg(preview).render().asPng());
const files = ["approved-logo-original.png", "wordmark-en.svg", "wordmark-zh.svg", "amber-light-v1.png", "icon.svg", "hi-drink-opening-v1.svg", "hi-drink-opening-v1.png", "hi-drink-opening-v1.webp"];
const assets = [];
for (const name of files) {
  const data = await read(name);
  assets.push({ file: name, sha256: createHash("sha256").update(data).digest("hex"), bytes: data.length });
}
await save("manifest.json", `${JSON.stringify({
  brand: { en: "hi drink", "zh-Hant": "嗨飲", "zh-Hans": "嗨飲" },
  source: "whattodrink_ios/docs/design/hi-drink-motion-poc/index.html",
  logoCrop: { x: 0, y: 6, width: 320, height: 332, cornerRadius: 80 },
  wordmarks: { en: "Cormorant Garamond 500", zh: "LXGW WenKai TC" },
  generation: { mode: "built-in imagegen", scope: "Decorative amber light only. Original logo and outlined lettering composed without regeneration.", prompt: "prompt.txt" },
  renderer: "scripts/render-intro-brand.mjs",
  assets,
}, null, 2)}\n`);
