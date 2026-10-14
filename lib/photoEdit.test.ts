import { describe, expect, it } from "vitest";

import {
  adjustCss,
  blankEdit,
  cropRect,
  isIdentityEdit,
  rotatedSize,
  sanitizeEdit,
  sanitizeText,
  wrapLines,
} from "./photoEdit";

describe("photoEdit", () => {
  it("空 edit 恆等", () => {
    expect(isIdentityEdit(blankEdit())).toBe(true);
    expect(adjustCss(blankEdit())).toBe("");
  });
  it("消毒歸零", () => {
    expect(sanitizeEdit(null)).toEqual(blankEdit());
    expect(sanitizeEdit({ brightness: 5, ratio: "x", quarterTurns: 5 }).brightness).toBe(1);
    expect(sanitizeEdit({ quarterTurns: 5 }).quarterTurns).toBe(1);
  });
  it("旋轉互換寬高", () => {
    expect(rotatedSize(400, 300, 1)).toEqual({ w: 300, h: 400 });
    expect(rotatedSize(400, 300, 2)).toEqual({ w: 400, h: 300 });
    expect(rotatedSize(0, 5, 1)).toEqual({ w: 0, h: 0 });
  });
  it("居中裁切", () => {
    expect(cropRect(400, 300, "original")).toEqual({ x: 0, y: 0, w: 400, h: 300 });
    expect(cropRect(400, 300, "square")).toEqual({ x: 50, y: 0, w: 300, h: 300 });
    expect(cropRect(300, 400, "square")).toEqual({ x: 0, y: 50, w: 300, h: 300 });
    expect(cropRect(400, 500, "portrait")).toEqual({ x: 0, y: 0, w: 400, h: 500 });
  });
  it("調整 CSS 串", () => {
    const css = adjustCss({ ...blankEdit(), brightness: 1, contrast: -1, warmth: 0.5 });
    expect(css).toContain("brightness(1.250)");
    expect(css).toContain("contrast(0.650)");
    expect(css).toContain("sepia(0.175)");
  });
  it("文字消毒＋換行", () => {
    expect(sanitizeText(null).pos).toBe("bottom");
    const m = { measureText: (s: string) => ({ width: s.length * 10 }) };
    expect(wrapLines(m, "abcdef", 25, 3)).toEqual(["ab", "cd", "ef"]);
    expect(wrapLines(m, "a\n\nb", 100, 3)).toEqual(["a", "", "b"]);
  });
});
