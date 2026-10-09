import { describe, expect, it } from "vitest";

import {
  aggregateTaste,
  beerCategorySignal,
  groupOfKey,
  isTasteKey,
  parsePreferences,
  parseTags,
} from "./taste";

describe("isTasteKey／groupOfKey", () => {
  it("大小类合法；未知拒；子类反推大类", () => {
    expect(isTasteKey("whisky")).toBe(true);
    expect(isTasteKey("spirits")).toBe(true);
    expect(isTasteKey("可乐")).toBe(false);
    expect(groupOfKey("whisky")).toBe("spirits");
    expect(groupOfKey("sake")).toBe("sake");
    expect(groupOfKey("可乐")).toBeNull();
  });
});

describe("beerCategorySignal", () => {
  it("精确命中＋显式映射＋无信号 null", () => {
    expect(beerCategorySignal("whisky")).toEqual({ group: "spirits", sub: "whisky" });
    expect(beerCategorySignal("lager")).toEqual({ group: "beer", sub: "lager" });
    expect(beerCategorySignal("craft beer")).toEqual({ group: "beer", sub: "craft" });
    expect(beerCategorySignal("red wine")).toEqual({ group: "wine", sub: "red" });
    expect(beerCategorySignal("cocktail")).toEqual({ group: "cocktail", sub: null });
    expect(beerCategorySignal("精酿之光")).toBeNull();
    expect(beerCategorySignal(null)).toBeNull();
  });
});

describe("parsePreferences", () => {
  const good = { favorites: ["whisky"], likes: ["cocktail", "sake"], dislikes: ["beer"] };
  it("收全段（去重透传）", () => {
    expect(parsePreferences(good)).toEqual({ body: good });
  });
  it("超限／未知／互斥／双空拒", () => {
    expect(parsePreferences({ ...good, favorites: ["a", "b", "c", "d"] as never[] })).toHaveProperty("error");
    expect(parsePreferences({ ...good, likes: ["可乐"] })).toHaveProperty("error");
    expect(parsePreferences({ favorites: ["whisky"], likes: ["whisky"], dislikes: [] })).toHaveProperty("error");
    expect(parsePreferences({ favorites: [], likes: [], dislikes: ["beer"] })).toHaveProperty("error");
    expect(parsePreferences({ favorites: [], likes: [], dislikes: [] })).toHaveProperty("error");
  });
});

describe("parseTags", () => {
  it("缺席 null；≤5 去重；非法拒", () => {
    expect(parseTags(undefined)).toBeNull();
    expect(parseTags(["whisky", "whisky"])).toEqual({ tags: ["whisky"] });
    expect(parseTags(["a", "b", "c", "d", "e", "f"])).toHaveProperty("error");
    expect(parseTags(["可乐"])).toHaveProperty("error");
    expect(parseTags([])).toEqual({ tags: [] });
  });
});

describe("aggregateTaste", () => {
  it("tags 计数＋酒款兜底＋归一 max=1.0＋零值不回", () => {
    const r = aggregateTaste([
      { tags: ["whisky", "highball"], beerCategory: null },
      { tags: [], beerCategory: "lager" },
      { tags: [], beerCategory: "精酿之光" },
      { tags: ["sake"], beerCategory: null },
    ]);
    expect(r.sample_count).toBe(3);
    const spirits = r.groups.find((g) => g.key === "spirits");
    const cocktail = r.groups.find((g) => g.key === "cocktail");
    const beer = r.groups.find((g) => g.key === "beer");
    expect(spirits?.strength).toBe(1);
    expect(spirits?.items).toEqual([{ key: "whisky", strength: 1 }]);
    expect(cocktail?.items).toEqual([{ key: "highball", strength: 1 }]);
    expect(beer?.items).toEqual([{ key: "lager", strength: 1 }]);
    expect(r.groups.find((g) => g.key === "sake")?.strength).toBe(1);
  });
  it("空输入零组零样本", () => {
    expect(aggregateTaste([])).toEqual({ groups: [], sample_count: 0 });
  });
});
