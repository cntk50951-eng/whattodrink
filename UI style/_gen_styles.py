#!/usr/bin/env python3
"""Generate 20 UI style beer-themed images via the MiniMax image_generation API.

API key is loaded from the project's .env file (MINIMAX_API_KEY=...) at runtime —
it is never written into this script or the shell command line.
"""
import base64
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
OUT_DIR = PROJECT_ROOT / "UI style"
OUT_DIR.mkdir(exist_ok=True)

API_URL = "https://api.minimax.cn/v1/image_generation"


def load_api_key() -> str:
    if not ENV_PATH.exists():
        sys.exit(f".env not found at {ENV_PATH}")
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("minimaxi_api_key="):
            return line.split("=", 1)[1].strip()
    sys.exit("minimaxi_api_key not found in .env")


STYLES = [
    (1, "Flat Illustration 扁平插畫",
     "A frothy amber beer mug centered on a deep navy background. Flat illustration style: bold blocks of color, thick black outlines, minimal geometric shapes, zero gradients, zero realism. Warm amber beer, cream-colored foam. Friendly approachable vector art."),
    (2, "Ligne Claire 清晰線條",
     "A foaming beer mug and a glass bottle of beer on a wooden bar counter. Ligne Claire style: perfectly uniform black line weight throughout, completely flat color fills, no hatching, no shading, no gradients. Tintin comic tradition. Muted vintage palette with pops of warm amber and dark teal. Clean and elegant."),
    (3, "Corporate Memphis 變體",
     "A young Hong Konger with exaggerated proportions happily enjoying a cold beer at a traditional green dai pai dong. Differentiated Corporate Memphis style: diverse character proportions, soft pastels (mint, peach, lavender, dusty rose), geometric shape ornaments. Include HK elements: neon Chinese sign, red minibus, bamboo scaffolding. Culturally rooted, vibrant."),
    (4, "Sticker 貼紙風",
     "A set of cute sticker-style illustrations for a beer app: a foaming beer mug, a glass bottle, green hops, golden barley. Every element has thick white border (die-cut look) and soft drop shadow. Bright cheerful colors, playful slightly tilted composition. LINE/KakaoTalk sticker style. Soft pastel cream background."),
    (5, "Memphis Design 孟菲斯風",
     "A poster-style illustration of a frosty beer glass with retro 1990s Memphis Design aesthetic. Bold black geometric shapes (squiggles, triangles, circles, zigzags) scattered around. Terrazzo speckles. Clashing colors: hot pink, teal, mustard yellow, black, white. Playful, loud, highly graphic. Flat colors only."),
    (6, "Pop Art 美式漫畫網點",
     "A comic-book Pop Art illustration of a frothy beer mug. Roy Lichtenstein aesthetic. Thick black ink outlines, bold primary colors (red yellow blue), halftone Ben-Day dots for shading. Black action lines radiating. Comic-style speech bubble with 'BEER!'. Flat colors with halftone overlay."),
    (7, "Y2K 千禧風",
     "A bubbly beer drink in Y2K aesthetic. Chrome metallic surfaces, bold bubble shapes, holographic gradients in pink cyan purple. Liquid mercury shine, translucent jelly textures, floating iridescent bubbles, tiny star sparkles. Late-90s magazine ad. Glossy plastic dreamy."),
    (8, "Vintage Tiki 雞尾酒海報",
     "A vintage Tiki cocktail poster for a bar app. A tall exotic tiki drink with paper umbrella and tropical leaves, surrounded by carved tiki masks, bamboo, hibiscus, and a torch. Warm sunset gradient (orange deep red). Vintage palette (teal coral mustard brown). Mid-century tropical kitsch. Faded printed poster."),
    (9, "Vintage Travel Poster 復古旅行海報",
     "A vintage 1950s travel poster of Hong Kong. A large frosty beer mug in the foreground with simplified Hong Kong skyline behind (Victoria Harbour, red-sail junk boat, Star Ferry, Lion Rock). Bold flat color blocks in muted vintage palette (cream, mustard, teal, faded red). Retro typography 'Whattodrink Hong Kong'. Distressed paper texture."),
    (10, "Cutout Collage 剪紙拼貼",
     "A cutout paper collage illustration of a beer bottle and glass on a wooden bar counter. Layered torn paper shapes overlapping with visible drop shadows. Frosty glass, bottle with label, green hops, lemon slice. Warm earthy palette: kraft brown, mustard, terracotta, sage green, deep red. Hand-cut feel, cozy craft beer mood."),
    (11, "Doodle 塗鴉疊加",
     "Hand-drawn doodle illustration of beer elements scattered playfully on cream background: a frothy beer mug, hop cone, barley grains, bubbles, 'cheers!' speech bubble. Imperfect wobbly black ink lines, childlike charm, hand-lettered. Minimal accent colors (mustard, pink, teal). Notebook sketch aesthetic."),
    (12, "Gouache 水粉插畫",
     "A gouache painting of a frothy beer mug on a rustic wooden bar counter. Warm hand-painted textures, soft edges, gentle color transitions, slight paper grain. Cozy palette: rich amber, cream foam, walnut brown wood, soft gold. Soft white highlights, visible brushstrokes. Atmospheric artisanal mood."),
    (13, "Woodcut 木刻版畫",
     "A woodcut print illustration of a frothy beer mug. Bold hand-carved black lines, high-contrast black and cream background. Small spot of warm amber ink. Visible carved gouge marks, rough organic edges, dense parallel hatching. Rustic craft beer label aesthetic."),
    (14, "Watercolor 水彩暈染",
     "A delicate watercolor illustration of a glass of amber beer. Soft color bleeds, wet-on-wet technique, light washes. Background washes of pale gold, dusty pink, sage green blend together. Elegant contemplative mood like a craft beer label. Lots of white space."),
    (15, "Bauhaus 包浩斯幾何",
     "A Bauhaus geometric composition with a beer mug. Pure primary colors (red, blue, yellow) on cream background. The mug is abstracted into stacked rectangles and circles. Clean sans-serif typography. Minimalist German design school aesthetic. Lots of white space."),
    (16, "Isometric 等距插畫",
     "An isometric 3D illustration of a cozy bar corner. A frothy beer mug on a rustic wooden counter with a bottle, hops, lemon slices, peanuts. Clean geometric isometric perspective, soft shadows, flat colors with subtle shading. Warm artisanal palette (amber, walnut, sage, cream). Craft beer hero scene."),
    (17, "Terrazzo 水磨石紋理",
     "A modern Italian terrazzo pattern with multi-color speckled aggregate (hot pink, teal, mustard, black, white). Embedded as decorative chips: a beer mug, hop cone, barley, bottle cap. The terrazzo is the star. Playful, graphic, clean. Top-down flat lay view."),
    (18, "Blueprint 圖紙線稿",
     "A technical blueprint of a beer mug. White precise linework on deep navy drafting paper. Isometric projection view, top and side elevations. Technical annotations, measurement lines, dimension callouts, draft marks. Architectural drafting aesthetic. Clean, crisp, no shading."),
    (19, "Neo-Brutalism 新粗野主義",
     "A Neo-Brutalism illustration of a frothy beer mug. Thick black borders, harsh unrefined color blocks: acid yellow, hot pink, electric blue, lime green. Raw geometric shapes, intentionally unpolished, anti-design. Hand-drawn rough edges. Bold sans-serif text. Energetic confrontational. Flat colors, white background."),
    (20, "Risograph 孔版印刷",
     "A Risograph print of a beer mug and bottle. Limited spot color palette: only fluorescent pink and teal blue on cream paper. Visible ink grain texture, slight misregistration where colors overlap (creating purple-ish tone). Soft imperfect edges. Indie poster aesthetic. Real physical print feel."),
]


def generate_one(api_key: str, idx: int, name: str, prompt: str) -> tuple[int, str, str]:
    out_path = OUT_DIR / f"{idx:02d} {name.split()[0]}.jpg"
    if out_path.exists() and out_path.stat().st_size > 1000:
        return idx, "skipped (exists)", str(out_path)
    payload = {
        "model": "image-01",
        "prompt": prompt,
        "aspect_ratio": "1:1",
        "response_format": "base64",
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    for attempt in range(3):
        try:
            r = requests.post(API_URL, json=payload, headers=headers, timeout=120)
            if r.status_code != 200:
                return idx, f"http {r.status_code}: {r.text[:200]}", ""
            data = r.json()
            images = data.get("data", {}).get("image_base64") or []
            if not images:
                return idx, f"no image in response: {json.dumps(data)[:200]}", ""
            img_bytes = base64.b64decode(images[0])
            out_path.write_bytes(img_bytes)
            return idx, f"ok ({len(img_bytes)//1024} KB)", str(out_path)
        except Exception as e:
            if attempt == 2:
                return idx, f"error: {e}", ""
            time.sleep(2 + attempt * 2)
    return idx, "exhausted retries", ""


def main():
    api_key = load_api_key()
    print(f"Generating {len(STYLES)} images in parallel...")
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {
            ex.submit(generate_one, api_key, idx, name, prompt): idx
            for idx, name, prompt in STYLES
        }
        for f in as_completed(futures):
            idx, status, path = f.result()
            print(f"[{idx:02d}] {status}  {path}", flush=True)


if __name__ == "__main__":
    main()
