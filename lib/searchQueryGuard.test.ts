import { describe, expect, it } from "vitest";
import { matchBlockedSearchTerm } from "./searchQueryGuard";

describe("matchBlockedSearchTerm", () => {
  it("擋成人／性交易關鍵詞（含夾標點、全形、大小寫）", () => {
    expect(matchBlockedSearchTerm("想搵個炮友")).toBe("炮友");
    expect(matchBlockedSearchTerm("約 . 炮")).toBe("約炮");
    expect(matchBlockedSearchTerm("找一夜情")).toBe("一夜情");
    expect(matchBlockedSearchTerm("ＨＯＯＫＵＰ tonight")).toBe("hookup");
    expect(matchBlockedSearchTerm("Escort service")).toBe("escort");
  });
  it("正常喝酒搜索不誤傷", () => {
    for (const q of ["找愛喝精釀的女生", "尖沙咀有啤酒的酒吧", "今晚有冇人一齊飲酒", "25 歲左右喜歡威士忌", "附近有 happy hour 的地方"]) {
      expect(matchBlockedSearchTerm(q)).toBeNull();
    }
  });
});
