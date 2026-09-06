---
name: beer-icon
description: Draw hand-drawn SVG beer-brand icons from real product photos for the random-pick panel.
---

# Beer Icon Pipeline

Batch workflow for hand-drawn beer-brand icons (page doodle style, recognisable
at a glance). Never draw from memory — v1/v2 proved memory-drawn icons look
generic and get rejected at review.

## 0. Inputs

- Brand batch: HK 常喝＋轮廓区分度 (bottle vs can vs glass must vary).
- Existing code: `components/marketing/beer-icons/` (one file per brand +
  `index.ts` barrel, shared `BeerIconFrame` in `doodle.tsx`), preview wall at
  `app/[locale]/preview-beer-icons/page.tsx`.

## 1. Reference photos (mandatory)

For each brand, look at the real product before drawing:

1. Search Wikimedia Commons files:
   `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=<Name>&srnamespace=6&srlimit=6&format=json`
2. Download the best product shot at 800px:
   `https://commons.wikimedia.org/wiki/Special:FilePath/<filename>?width=800`
   into `/tmp/beer-ref/`.
3. View every image with the file-read tool and note the livery: container
   type + proportions, label layers (bands, medallions, arches), cap/lip,
   signature marks (star, harp, kung-fu pants, diagonal sash…).
4. No Commons hit (small craft brands): fall back to the official shop packshot
   (e.g. Shopify `products.json` → product image).
5. Delete `/tmp/beer-ref/` when done — temp files never enter the repo.

## 2. Draw

- One `<Brand>Icon` component per file, exported through `index.ts`, wrapped in
  `BeerIconFrame` with a **unique** `filterId` (duplicate ids break when SVGs
  share a page).
- Ink strokes stay themed (inherited from the frame) + wobble filter = doodle
  language; fills use **fixed brand hex** so each icon reads as the real beer.
- Type uses the `font-hand` class; never put a straight `'` inside SVG `<text>`
  (`react/no-unescaped-entities` — use `’`).
- Stylised likeness only, never an exact trademark copy (legal review still
  required before production use).

## 3. Preview

- Add each icon to the wall in `app/[locale]/preview-beer-icons/page.tsx`.
- The route MUST live under `app/[locale]/` — the next-intl middleware
  (`localePrefix: 'never'`) rewrites every page request into the `[locale]`
  segment, so a route outside it 404s forever.

## 4. Gates (all green before review)

- `npx tsc --noEmit`, `npm run lint` (0 errors), `npm test`.
- Hand the user the preview URL and wait for per-icon verdicts; iterate.

## 5. Records

- Backlog UR row: append a version note (what references were viewed, what v2
  mistakes were corrected).
- Memory entry for every mis-draw and toolchain pitfall.
- No commit / push without explicit user approval; the UR stays WIP until the
  user accepts the preview.
