import { describe, expect, it } from "vitest";

import {
  buildReasons,
  maxPossibleScore,
  meetParsePrompt,
  parseMeetReply,
  relaxedCriteria,
  sanitizeCriteria,
  scoreCandidate,
  tasteHeadline,
  tasteMatches,
} from "./meet";

describe("sanitizeCriteria（白名单丢弃）", () => {
  it("合法透过；非法键丢弃记 dropped；min>max 双删", () => {
    const { criteria, dropped } = sanitizeCriteria({
      gender: "female",
      age_min: 25,
      age_max: 30,
      interests: ["whisky", "whisky"],
      race: "asian",
      age_minn: 1,
    });
    expect(criteria).toEqual({ gender: "female", age_min: 25, age_max: 30, interests: ["whisky"] });
    expect(dropped).toContain("race");
    const bad = sanitizeCriteria({ age_min: 40, age_max: 30 });
    expect(bad.criteria.age_min).toBeUndefined();
    expect(bad.dropped).toContain("age_min");
    expect(sanitizeCriteria("nope").criteria).toEqual({});
  });
  it("枚举越界丢弃", () => {
    expect(sanitizeCriteria({ gender: "x" }).dropped).toContain("gender");
    expect(sanitizeCriteria({ age_min: 10 }).dropped).toContain("age_min");
    expect(sanitizeCriteria({ nearby_km: 0 }).dropped).toContain("nearby_km");
  });
});

describe("scoreCandidate（确定性）", () => {
  const c = { interests: ["whisky", "coffee"], languages: ["yue"], taste_groups: ["whisky"] };
  it("全中 100；部分按比例", () => {
    expect(
      scoreCandidate(c, { interests: 2, languages: 1, occupation: false, taste: true, mutual: 9, online: true, nearby: false }),
    ).toBe(100);
    const s = scoreCandidate(c, { interests: 0, languages: 0, occupation: false, taste: false, mutual: 0, online: false, nearby: false });
    expect(s).toBe(0);
    expect(
      scoreCandidate(c, { interests: 1, languages: 0, occupation: false, taste: false, mutual: 0, online: false, nearby: false }),
    ).toBe(Math.min(100, Math.round((4 * 100) / (8 + 3 + 4 + 5 + 2))));
  });
  it("0 条件只剩 mutual／online 分（确定性）", () => {
    expect(maxPossibleScore({})).toBe(7);
    expect(scoreCandidate({}, { interests: 9, languages: 9, occupation: true, taste: true, mutual: 9, online: true, nearby: true })).toBe(100);
    expect(scoreCandidate({}, { interests: 0, languages: 0, occupation: false, taste: false, mutual: 2, online: false, nearby: false })).toBe(
      Math.round((2 * 100) / 7),
    );
  });
});

describe("buildReasons（≤3，只用命中）", () => {
  it("优先级口味＞兴趣＞语言＞共同＞距离", () => {
    expect(
      buildReasons({ taste: "威士忌派", interest: "cafe_hopping", language: "yue", mutual: 2, nearbyM: 800 }),
    ).toEqual(["都係威士忌派", "都鍾意cafe hopping", "講粵語"]);
    expect(buildReasons({ taste: null, interest: null, language: null, mutual: 0, nearbyM: 2500 })).toEqual([
      "距你 2.5km",
    ]);
    expect(buildReasons({ taste: null, interest: null, language: null, mutual: 0, nearbyM: null })).toEqual([]);
  });
});

describe("relaxedCriteria", () => {
  it("年龄±5、距离翻倍、去 online_only", () => {
    const { note, criteria } = relaxedCriteria({ age_min: 25, age_max: 30, nearby_km: 5, online_only: true });
    expect(criteria).toEqual({ age_min: 20, age_max: 35, nearby_km: 10 });
    expect(note).toContain("年齡");
    const empty = relaxedCriteria({});
    expect(empty.criteria).toEqual({});
  });
});

describe("parseMeetReply", () => {
  it("抠 JSON＋ignored 上限；非法抛错", () => {
    const r = parseMeetReply('```json\n{"criteria": {"gender": "female"}, "ignored": ["a","b","c","d","e","f"]}\n```');
    expect(r.criteria).toEqual({ gender: "female" });
    expect(r.ignored).toHaveLength(5);
    expect(() => parseMeetReply("唔明你講乜")).toThrow();
  });
  it("tasteHeadline／tasteMatches", () => {
    expect(tasteHeadline("whisky")).toBe("威士忌派");
    expect(tasteHeadline("nope")).toBeNull();
    expect(tasteMatches("whisky", ["whisky", "beer"])).toBe(true);
    expect(tasteMatches(null, ["whisky"])).toBe(false);
    expect(meetParsePrompt().system).toContain("whisky");
  });
});
