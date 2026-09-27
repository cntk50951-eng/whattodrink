import { describe, expect, it } from "vitest";

import {
  BEAUTY_CSS,
  PHOTO_FILTER_CSS,
  PHOTO_FILTER_IDS,
  fitPhotoSize,
  isPhotoFilterId,
  photoFilterCss,
} from "./photoFilters";

describe("photoFilters (UR E.1)", () => {
  it("6 款 id 唯一且 css 非空", () => {
    expect(new Set(PHOTO_FILTER_IDS).size).toBe(6);
    for (const id of PHOTO_FILTER_IDS) {
      expect(PHOTO_FILTER_CSS[id].length).toBeGreaterThan(0);
    }
  });
  it("非法 id 回原相機，不拋", () => {
    expect(photoFilterCss("nope", false)).toBe("none");
    expect(photoFilterCss(null, false)).toBe("none");
    expect(isPhotoFilterId("film")).toBe(true);
    expect(isPhotoFilterId("ig-pro")).toBe(false);
  });
  it("美顏開關疊加（none 檔只剩美顏串）", () => {
    expect(photoFilterCss("none", true)).toBe(BEAUTY_CSS);
    expect(photoFilterCss("film", true)).toContain(PHOTO_FILTER_CSS.film);
    expect(photoFilterCss("film", true)).toContain(BEAUTY_CSS);
  });
  it("fitPhotoSize 等比壓到上限內", () => {
    expect(fitPhotoSize(4000, 3000)).toEqual({ w: 1024, h: 768 });
    expect(fitPhotoSize(800, 600)).toEqual({ w: 800, h: 600 });
    expect(fitPhotoSize(0, 0)).toEqual({ w: 0, h: 0 });
  });
});
