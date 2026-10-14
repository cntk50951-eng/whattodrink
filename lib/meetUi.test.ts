import { describe, expect, it } from "vitest";

import type { MeetCriteria } from "./meet";
import {
  meetChips,
  meetCriteriaWithout,
  meetDistanceText,
  meetEmptyExplanation,
  meetErrorKind,
  meetProgressText,
  meetScoreText,
  type MeetChipLabels,
} from "./meetUi";

const L: MeetChipLabels = {
  female: "♀ 女",
  male: "♂ 男",
  ageBelow: (hi) => `${hi} 歲或以下`,
  ageAbove: (lo) => `${lo} 歲或以上`,
  ageExact: (n) => `${n} 歲`,
  ageRange: (lo, hi) => `${lo}–${hi} 歲`,
  heightBelow: (hi) => `≤${hi} cm`,
  heightAbove: (lo) => `≥${lo} cm`,
  heightRange: (lo, hi) => `${lo}–${hi} cm`,
  nearby: (km) => `附近 ${km} km`,
  online: "在線",
};

describe("meetChips", () => {
  it("空條件零 chip", () => {
    expect(meetChips({}, L)).toEqual([]);
  });
  it("全類條件順序固定", () => {
    const c: MeetCriteria = {
      gender: "female",
      age_min: 27,
      age_max: 33,
      languages: ["yue"],
      taste_groups: ["whisky"],
      nearby_km: 5,
      online_only: true,
    };
    const labels = meetChips(c, L).map((x) => x.label);
    expect(labels).toEqual(["♀ 女", "27–33 歲", "yue", "whisky", "附近 5 km", "在線"]);
  });
  it("單邊年齡", () => {
    expect(meetChips({ age_max: 30 }, L)[0]?.label).toBe("30 歲或以下");
    expect(meetChips({ age_min: 30 }, L)[0]?.label).toBe("30 歲或以上");
    expect(meetChips({ age_min: 30, age_max: 30 }, L)[0]?.label).toBe("30 歲");
  });
});

describe("meetCriteriaWithout", () => {
  it("點掉性別／年齡整組清", () => {
    const c: MeetCriteria = { gender: "male", age_min: 20, age_max: 29, nearby_km: 5 };
    expect(meetCriteriaWithout(c, "gender")).toEqual({ age_min: 20, age_max: 29, nearby_km: 5 });
    expect(meetCriteriaWithout(c, "age")).toEqual({ gender: "male", nearby_km: 5 });
  });
  it("列表逐 key 掉、掉光歸 undefined", () => {
    const c: MeetCriteria = { interests: ["hiking", "pets"] };
    expect(meetCriteriaWithout(c, { list: "interests", key: "hiking" })).toEqual({ interests: ["pets"] });
    expect(meetCriteriaWithout(c, { list: "interests", key: "nope" })).toEqual(c);
    const solo: MeetCriteria = { interests: ["hiking"] };
    expect(meetCriteriaWithout(solo, { list: "interests", key: "hiking" })).toEqual({});
  });
});

describe("展示小工具", () => {
  it("分數鉗 0–100", () => {
    expect(meetScoreText(120, "%")).toBe("100%");
    expect(meetScoreText(-3, "%")).toBe("0%");
    expect(meetScoreText(86.4, "%")).toBe("86%");
  });
  it("距離：null 無行；<1km 取整 100m", () => {
    expect(meetDistanceText(null, "距你", "km")).toBeNull();
    expect(meetDistanceText(-5, "距你", "km")).toBeNull();
    expect(meetDistanceText(800, "距你", "km")).toBe("距你 800m");
    expect(meetDistanceText(2500, "距你", "km")).toBe("距你 2.5km");
  });
  it("進度四段按秒切", () => {
    const s: [string, string, string, string] = ["a", "b", "c", "d"];
    expect(meetProgressText(1, s)).toBe("a");
    expect(meetProgressText(3, s)).toBe("b");
    expect(meetProgressText(8, s)).toBe("c");
    expect(meetProgressText(30, s)).toBe("d");
  });
});

describe("meetErrorKind", () => {
  it("狀態碼矩陣（iOS 口徑）", () => {
    expect(meetErrorKind(401, null)).toBe("unauthorized");
    expect(meetErrorKind(403, "onboarding_required")).toBe("onboardingRequired");
    expect(meetErrorKind(403, "age_restricted")).toBe("ageRestricted");
    expect(meetErrorKind(403, "rejected")).toBe("rejected");
    expect(meetErrorKind(404, null)).toBe("notDeployed");
    expect(meetErrorKind(429, null)).toBe("quotaExhausted");
    expect(meetErrorKind(503, "ai_unavailable")).toBe("aiUnavailable");
    expect(meetErrorKind(500, null)).toBe("other");
  });
});

describe("meetEmptyExplanation", () => {
  const T = {
    poolEmpty: "pool-empty",
    nonePassed: (p: number) => `none/${p}`,
    somePassed: (p: number, q: number) => `some/${p}/${q}`,
    friendsHint: (n: number) => `friends/${n}`,
    fallbackWithCriteria: "relax",
    fallbackNoCriteria: "say-more",
  };
  it("池空＋好友提示並列", () => {
    expect(meetEmptyExplanation({ pool: 0, passed: 0 }, 2, true, T)).toBe("pool-empty\nfriends/2");
  });
  it("無統計無提示按條件選 fallback", () => {
    expect(meetEmptyExplanation(null, null, true, T)).toBe("relax");
    expect(meetEmptyExplanation(null, 0, false, T)).toBe("say-more");
  });
});
