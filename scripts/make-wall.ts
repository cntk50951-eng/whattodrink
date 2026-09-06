/**
 * Render BEER_WALL to a static HTML file for headless-Chrome screenshotting.
 * Run via tsx (imports .tsx icon components). No dev server needed.
 *
 * Fidelity notes: theme-dependent `var(--border)` is baked to the light-theme
 * hex (see LIGHT_TOKENS); Caveat is loaded from a local TTF so export does not
 * depend on Google Fonts availability.
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BEER_WALL, beerSlug } from "../components/marketing/beer-icons/wall";

const WALL_PATH = process.env.BEER_WALL_PATH ?? "/tmp/beer-wall.html";
const FONT_ABS = resolve(process.env.BEER_FONT_PATH ?? "scripts/assets/Caveat.ttf");

/** Light-theme (`:root`) values for every var() the icons use. */
const LIGHT_TOKENS: Record<string, string> = {
  // oklch(0.922 0 0)
  "--border": "#e5e5e5",
  // oklch(0.145 0 0)
  "--foreground": "#0a0a0a",
};

const W = 432;
const H = 576; // 4x of the wall's 108x144 render

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const head = `<meta charset="utf-8"><style>
@font-face{font-family:"Caveat";src:url("file://${FONT_ABS}");}
body{margin:0;background:#fff;}
.font-hand{font-family:"Caveat",cursive;}
</style>`;

const renderSvg = (Icon: (typeof BEER_WALL)[number]["Icon"]) => {
  let svg = renderToStaticMarkup(createElement(Icon));
  for (const [token, hex] of Object.entries(LIGHT_TOKENS)) {
    svg = svg.split(`var(${token})`).join(hex);
  }
  return svg.replace('width="100%"', `width="${W}" height="${H}"`);
};

const cards = BEER_WALL.map(({ en, cn, Icon }) => {
  const slug = beerSlug(en);
  return `<div data-slug="${slug}" data-caption="${esc(en)}（${esc(cn)}）">${renderSvg(Icon)}</div>`;
}).join("\n");

writeFileSync(
  WALL_PATH,
  `<!DOCTYPE html><html><head>${head}<style>div[data-slug]{width:${W}px;}</style></head><body>${cards}</body></html>\n`,
);
console.log(`wall: ${BEER_WALL.length} icons -> ${WALL_PATH}`);

// Pure per-icon SVGs (vector deliverable) + 4x PNGs via resvg.
// No browser needed: resvg renders filters + text from loaded font files.
const OUT_DIR = process.env.BEER_OUT_DIR ?? "exported/beer-icons";
const SVG_DIR = `${OUT_DIR}/svg`;
const RAW_DIR = `${OUT_DIR}/.raw`;
mkdirSync(SVG_DIR, { recursive: true });
mkdirSync(RAW_DIR, { recursive: true });
const resvgFonts = {
  fontFiles: [resolve("scripts/assets/Caveat.ttf")],
  loadSystemFonts: true,
  defaultFontFamily: "Caveat",
};
for (const { en, Icon } of BEER_WALL) {
  const slug = beerSlug(en);
  const svg = renderSvg(Icon).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  writeFileSync(`${SVG_DIR}/${slug}.svg`, svg + "\n");
  const png = new Resvg(svg, { font: resvgFonts }).render().asPng();
  writeFileSync(`${RAW_DIR}/${slug}@4x.png`, png);
}
console.log(`svg+raw: ${BEER_WALL.length} icons -> ${SVG_DIR}/ + ${RAW_DIR}/`);

// Manifest (single source knows slugs + captions + types; file sets are fixed).
const manifest = BEER_WALL.map(({ en, cn, type }) => {
  const slug = beerSlug(en);
  return {
    slug,
    caption: `${en}（${cn}）`,
    type,
    svg: `svg/${slug}.svg`,
    ios: ["@1x", "@2x", "@3x"].map((s) => `ios/${slug}${s}.png`),
    android: ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"].map(
      (d) => `android/drawable-${d}/${slug}.png`,
    ),
  };
});
writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${manifest.length} icons -> ${OUT_DIR}/manifest.json`);
