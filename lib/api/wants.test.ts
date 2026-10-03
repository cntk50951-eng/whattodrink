import { describe, expect, it } from "vitest";

import { asWantCount, buildWantJson } from "./wants";

describe("asWantCount", () => {
  it("正常数下取整", () => {
    expect(asWantCount(7)).toBe(7);
  });
  it("脏值钳零（负／非数／无穷／null）", () => {
    expect(asWantCount(-1)).toBe(0);
    expect(asWantCount("7")).toBe(0);
    expect(asWantCount(Number.NaN)).toBe(0);
    expect(asWantCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(asWantCount(null)).toBe(0);
  });
});

describe("buildWantJson", () => {
  it("透 wanted＋count 走钳制", () => {
    expect(buildWantJson(true, 2)).toEqual({ wanted: true, want_count: 2 });
    expect(buildWantJson(false, -5)).toEqual({ wanted: false, want_count: 0 });
  });
});
