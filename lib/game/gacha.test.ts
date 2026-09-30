import { describe, expect, it } from "vitest";

import { BEER_CATEGORIES } from "../beers";
import { PITY_LIMIT, drawBrand, isNewDay, rollLane } from "./gacha";

describe("rollLane (UR G1.1)", () => {
  it("均勻抽取（種子決定位置）；空池回 null", () => {
    expect(rollLane(BEER_CATEGORIES, () => 0)?.id).toBe("beer");
    expect(rollLane(BEER_CATEGORIES, () => 0.999)?.id).toBe("baijiu");
    expect(rollLane([], () => 0.5)).toBeNull();
  });
});

describe("drawBrand (UR G1.1)", () => {
  const pool = ["a", "b", "c", "d", "e", "f"];
  it("保底：連 5 重複必從缺格出（rand 指哪都強制 NEW）", () => {
    const r = drawBrand(pool, ["a", "b", "c", "d", "e"], PITY_LIMIT, () => 0.0);
    expect(r).toEqual({ id: "f", isNew: true, nextPityStreak: 0 });
  });
  it("未達保底：命中已擁有即重複＋續杯；命中缺格即清零", () => {
    const dupe = drawBrand(pool, ["a"], 2, () => 0.0);
    expect(dupe).toEqual({ id: "a", isNew: false, nextPityStreak: 3 });
    const fresh = drawBrand(pool, ["a"], 2, () => 0.5);
    expect(fresh?.isNew).toBe(true);
    expect(fresh?.nextPityStreak).toBe(0);
  });
  it("本類集滿：保底順延（不強制，保底不斷）", () => {
    const r = drawBrand(["a"], ["a"], 9, () => 0.0);
    expect(r).toEqual({ id: "a", isNew: false, nextPityStreak: 10 });
  });
  it("空池回 null；髒 pity 歸零起算", () => {
    expect(drawBrand([], [], 3, () => 0)).toBeNull();
    const r = drawBrand(pool, ["a"], Number.NaN, () => 0.0);
    expect(r?.nextPityStreak).toBe(1);
  });
});

describe("isNewDay (UR G1.1)", () => {
  it("無記錄即首抽；同日 false，跨日 true", () => {
    expect(isNewDay(null, "2026-09-30")).toBe(true);
    expect(isNewDay("2026-09-30", "2026-09-30")).toBe(false);
    expect(isNewDay("2026-09-29", "2026-09-30")).toBe(true);
  });
});
