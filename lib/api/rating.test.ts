import { describe, expect, it } from "vitest";

import { formatAvgRating, parseRatingBody, summarizeRatings } from "./rating";

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

describe("formatAvgRating", () => {
  it("n≥1 即 x.x 分（四舍五入 1 位），无分回 null", () => {
    expect(formatAvgRating(4)).toBe("4.0 分");
    expect(formatAvgRating(13 / 3)).toBe("4.3 分");
    expect(formatAvgRating(null)).toBeNull();
    expect(formatAvgRating(0)).toBeNull();
    expect(formatAvgRating(5.2)).toBeNull();
  });
});

describe("summarizeRatings", () => {
  it("均值＋人数；脏行过滤；空即 null＋0", () => {
    expect(summarizeRatings([{ rating: 5 }, { rating: 4 }, { rating: 3 }])).toEqual({
      avg: 4,
      count: 3,
    });
    expect(summarizeRatings([{ rating: 5 }, { rating: 0 }, { rating: "5" }, {}])).toEqual({
      avg: 5,
      count: 1,
    });
    expect(summarizeRatings([])).toEqual({ avg: null, count: 0 });
  });
});
