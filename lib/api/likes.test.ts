import { describe, expect, it } from "vitest";

import { asLikeCount, buildLikeJson } from "./likes";

describe("asLikeCount", () => {
  it("正常数下取整", () => {
    expect(asLikeCount(12)).toBe(12);
  });
  it("脏值钳零（负／非数／无穷／null）", () => {
    expect(asLikeCount(-3)).toBe(0);
    expect(asLikeCount("12")).toBe(0);
    expect(asLikeCount(Number.NaN)).toBe(0);
    expect(asLikeCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(asLikeCount(null)).toBe(0);
  });
});

describe("buildLikeJson", () => {
  it("透 liked＋count 走钳制", () => {
    expect(buildLikeJson(true, 3)).toEqual({ liked: true, like_count: 3 });
    expect(buildLikeJson(false, -1)).toEqual({ liked: false, like_count: 0 });
  });
});
