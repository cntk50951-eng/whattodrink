import { describe, expect, it } from "vitest";

import {
  buildReasons,
  dropNoisyGroups,
  isFullMatch,
  maxPossibleScore,
  meetParsePrompt,
  parseMeetReply,
  preferredHeadline,
  relaxedCriteria,
  sanitizeCriteria,
  scoreCandidate,
  tasteHeadline,
  tasteLevel,
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
      scoreCandidate(c, { interests: 2, languages: 1, occupation: false, tasteLevel: 3, mutual: 9, online: true, nearby: false }),
    ).toBe(100);
    const s = scoreCandidate(c, { interests: 0, languages: 0, occupation: false, tasteLevel: 0, mutual: 0, online: false, nearby: false });
    expect(s).toBe(0);
    expect(
      scoreCandidate(c, { interests: 1, languages: 0, occupation: false, tasteLevel: 1, mutual: 0, online: false, nearby: false }),
    ).toBe(Math.min(100, Math.round(((4 + 4) * 100) / (8 + 3 + 8 + 5 + 2))));
  });
  it("0 条件只剩 mutual／online 分（确定性）", () => {
    expect(maxPossibleScore({})).toBe(7);
    expect(scoreCandidate({}, { interests: 9, languages: 9, occupation: true, tasteLevel: 3, mutual: 9, online: true, nearby: true })).toBe(100);
    expect(scoreCandidate({}, { interests: 0, languages: 0, occupation: false, tasteLevel: 0, mutual: 2, online: false, nearby: false })).toBe(
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
  it("tasteHeadline／prompt 含规则＋示例", () => {
    expect(tasteHeadline("whisky")).toBe("威士忌派");
    expect(tasteHeadline("nope")).toBeNull();
    const sys = meetParsePrompt().system;
    expect(sys).toContain("whisky");
    expect(sys).toContain("X±3");
    expect(sys).toContain("我想找一個女生");
  });
  it("dropNoisyGroups（整组乱填即丢）", () => {
    const noisy = dropNoisyGroups({
      taste_groups: ["beer", "wine", "sake", "gin", "rum"],
      interests: ["a", "b", "c", "d", "e", "f"],
      occupations: ["tech"],
      languages: ["yue"],
    });
    expect(noisy.criteria.taste_groups).toBeUndefined();
    expect(noisy.criteria.interests).toBeUndefined();
    expect(noisy.criteria.occupations).toEqual(["tech"]);
    expect(noisy.droppedGroups).toContain("taste_groups");
    const clean = dropNoisyGroups({ taste_groups: ["beer"], interests: ["a"] });
    expect(clean.droppedGroups).toEqual([]);
    expect(clean.criteria.taste_groups).toEqual(["beer"]);
  });
  it("taste_keys 白名单（大类＋子类；非法丢）", () => {
    expect(sanitizeCriteria({ taste_keys: ["lager", "beer"] }).criteria).toEqual({ taste_keys: ["lager", "beer"] });
    expect(sanitizeCriteria({ taste_keys: ["外貌"] }).dropped).toContain("taste_keys");
    expect(sanitizeCriteria({ taste_keys: "lager" }).dropped).toContain("taste_keys");
  });
  it("tasteLevel：声明优先 favorites＞likes＞推断；dislikes 归零", () => {
    const c = { taste_keys: ["lager"] };
    expect(tasteLevel(c, { favorites: ["lager"], likes: [], dislikes: [] }, "beer")).toBe(3);
    expect(tasteLevel(c, { favorites: ["beer"], likes: [], dislikes: [] }, null)).toBe(3);
    expect(tasteLevel(c, { favorites: [], likes: ["beer"], dislikes: [] }, null)).toBe(2);
    expect(tasteLevel(c, { favorites: [], likes: [], dislikes: [] }, "beer")).toBe(1);
    expect(tasteLevel(c, { favorites: ["lager"], likes: [], dislikes: ["beer"] }, "beer")).toBe(0);
    expect(tasteLevel(c, { favorites: [], likes: [], dislikes: [] }, null)).toBe(0);
    expect(tasteLevel({}, { favorites: ["lager"], likes: [], dislikes: [] }, "beer")).toBe(0);
    expect(tasteLevel({ taste_groups: ["whisky"] }, { favorites: [], likes: [], dislikes: [] }, "beer")).toBe(0);
  });
  it("isFullMatch／preferredHeadline", () => {
    expect(
      isFullMatch({ interests: ["a"], taste_keys: ["lager"] }, { occupations: false, languages: 0, interests: 1, tasteLevel: 3 }),
    ).toBe(true);
    expect(
      isFullMatch({ interests: ["a"], taste_keys: ["lager"] }, { occupations: false, languages: 0, interests: 1, tasteLevel: 0 }),
    ).toBe(false);
    expect(isFullMatch({}, { occupations: false, languages: 0, interests: 0, tasteLevel: 0 })).toBe(true);
    expect(
      preferredHeadline({ taste_keys: ["lager"] }, { favorites: [], likes: ["beer"], dislikes: [] }, "wine"),
    ).toBe("啤酒派");
    expect(preferredHeadline({}, { favorites: [], likes: [], dislikes: [] }, "wine")).toBe("葡萄酒派");
  });
});
