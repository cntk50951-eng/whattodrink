import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ARTWORK_SCREENS, artworkSrc, type ArtworkId } from "./artwork";

type Entry = { locale: "zh-Hant" | "zh-Hans" | "en"; name: string; file: string; width: number; height: number; sha256: string; uiKeys: string[] };
const base = new URL("../../public/intro-next/", import.meta.url);
const manifest: Entry[] = JSON.parse(readFileSync(new URL("artwork/manifest.json", base), "utf8"));
const labels: Record<string, Record<string, string>> = JSON.parse(readFileSync(new URL("ios-ui-copy.json", base), "utf8"));

describe("three-language promotional artwork", () => {
  it("has a complete photo-post flow and Ivy gameplay set for each locale", () => {
    for (const locale of ["zh-Hant", "zh-Hans", "en"]) {
      expect(manifest.filter((entry) => entry.locale === locale).map((entry) => entry.name)).toEqual(ARTWORK_SCREENS.map((screen) => screen.id));
    }
  });
  for (const entry of manifest) {
    it(`${entry.file} exists at full resolution with complete UI translations`, () => {
      const bytes = readFileSync(new URL(`artwork/${entry.file}`, base));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      expect([entry.width, entry.height]).toEqual([1170, 2532]);
      expect(artworkSrc(entry.name as ArtworkId, entry.locale)).toBe(`/intro-next/artwork/${entry.file}`);
      expect(entry.uiKeys.length).toBeGreaterThan(0);
      for (const key of entry.uiKeys) expect(labels[key]?.[entry.locale]).toBeTruthy();
    });
  }
  it("selects the actual artwork locale independently of page copy", () => {
    expect(artworkSrc("preview", "en")).toContain("/en/preview-v3.webp");
    expect(artworkSrc("preview", "zh-Hans")).toContain("/zh-Hans/preview-v3.webp");
    expect(artworkSrc("preview", "zh-Hant")).toContain("/zh-Hant/preview-v3.webp");
  });
});
