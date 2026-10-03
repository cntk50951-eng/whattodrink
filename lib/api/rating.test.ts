import { describe, expect, it } from "vitest";

import { formatRating, parseRatingBody } from "./rating";

describe("parseRatingBody", () => {
  it("1–5 整数收，null 清", () => {
    expect(parseRatingBody({ rating: 4 })).toEqual({ rating: 4 });
    expect(parseRatingBody({ rating: 1 })).toEqual({ rating: 1 });
    expect(parseRatingBody({ rating: null })).toEqual({ rating: null });
  });
  it("小数／越界／字符串／缺键即 400", () => {
    for (const bad of [{ rating: 4.5 }, { rating: 0 }, { rating: 6 }, { rating: "4" }, {}]) {
      expect(parseRatingBody(bad)).toHaveProperty("error");
    }
  });
});

describe("formatRating", () => {
  it("有分即 n 分，无分回 null（藏 pill）", () => {
    expect(formatRating(4)).toBe("4 分");
    expect(formatRating(null)).toBeNull();
    expect(formatRating(0)).toBeNull();
  });
});
