import { describe, expect, it } from "vitest";

import { ageOf, avatarPublicUrl, collectNightStats, hkAge, nightKeyHK, parseProfileBody, shouldOnboard, weekNights, weekStartHK, weekStreak } from "./profile";

describe("ageOf", () => {
  // 2026-10-04（UTC）为锚。
  const NOW = Date.parse("2026-10-04T00:00:00Z");
  it("足岁（生日过即＋1，不过即‑1）", () => {
    expect(ageOf("2000-10-03", NOW)).toBe(26);
    expect(ageOf("2000-10-04", NOW)).toBe(26);
    expect(ageOf("2000-10-05", NOW)).toBe(25);
  });
  it("未来／异形／太老回 null（不编岁数）", () => {
    expect(ageOf("2030-01-01", NOW)).toBeNull();
    expect(ageOf("1899-12-31", NOW)).toBeNull();
    expect(ageOf("not-a-date", NOW)).toBeNull();
    expect(ageOf(null, NOW)).toBeNull();
  });
});

describe("parseProfileBody", () => {
  it("四段全可选；性别只收男女", () => {
    expect(parseProfileBody({ gender: "male", dob: "2000-01-01", bio: " hi ", avatar_url: null })).toEqual({
      gender: "male",
      dob: "2000-01-01",
      bio: "hi",
      avatar_url: null,
    });
    expect(parseProfileBody({})).toEqual({});
  });
  it("非法拒（secret／异 dob／bio 截断／外桶头像；Google 头像放行）", () => {
    expect(parseProfileBody({ gender: "secret" })).toHaveProperty("error");
    expect(parseProfileBody({ dob: "01-01-2000" })).toHaveProperty("error");
    expect(parseProfileBody({ dob: "1800-01-01" })).toHaveProperty("error");
    const over = parseProfileBody({ bio: "x".repeat(200) });
    if ("error" in over) throw new Error("bio 应截断不断言");
    expect(over.bio?.length).toBe(140);
    expect(parseProfileBody({ avatar_url: "https://x.test/other/a.jpg" })).toHaveProperty("error");
    expect(parseProfileBody({ avatar_url: "https://lh3.googleusercontent.com/a/abc=s96-c" })).not.toHaveProperty(
      "error",
    );
    expect(parseProfileBody({ dob: "2020-01-01" })).toEqual({ error: "AGE_RESTRICTED" });
  });
});

describe("shouldOnboard", () => {
  const NOW = Date.parse("2026-10-04T00:00:00Z");
  it("打戳即不再弹；空戳＋7 天内新号弹；老号不扰", () => {
    expect(shouldOnboard("2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z", NOW)).toBe(false);
    expect(shouldOnboard(null, "2026-10-03T00:00:00Z", NOW)).toBe(true);
    expect(shouldOnboard(null, "2026-09-01T00:00:00Z", NOW)).toBe(false);
  });
});

describe("avatarPublicUrl", () => {
  it("公開桶直拼（尾斜杠容錯）", () => {
    expect(avatarPublicUrl("https://x.supabase.co/", "avatars", "u/a.jpg")).toBe(
      "https://x.supabase.co/storage/v1/object/public/avatars/u/a.jpg",
    );
  });
});

describe("nightKeyHK", () => {
  it("06:00 为界（前算前一晚；后算当天）", () => {
    // 2026-10-09T02:00Z ＝ HK 10:00 → 当天。
    expect(nightKeyHK(Date.parse("2026-10-09T02:00:00Z"))).toBe("2026-10-09");
    // 2026-10-08T21:00Z ＝ HK 10-09 05:00 → 前一晚 10-08。
    expect(nightKeyHK(Date.parse("2026-10-08T21:00:00Z"))).toBe("2026-10-08");
    // 整界 06:00 → 当天。
    expect(nightKeyHK(Date.parse("2026-10-08T22:00:00Z"))).toBe("2026-10-09");
    expect(nightKeyHK(NaN)).toBeNull();
  });
});

describe("hkAge", () => {
  it("HK 日历足岁；非法 null", () => {
    const NOW = Date.parse("2026-10-09T00:00:00Z"); // HK 10-09 08:00
    expect(hkAge("2000-10-09", NOW)).toBe(26);
    expect(hkAge("2000-10-10", NOW)).toBe(25);
    expect(hkAge("not-a-date", NOW)).toBeNull();
    expect(hkAge(null, NOW)).toBeNull();
  });
});

describe("weekStartHK／weekStreak／weekNights", () => {
  // 2026-10-09 是周五（HK）。
  const FRI = Date.parse("2026-10-09T04:00:00Z"); // HK 12:00
  it("周一起点", () => {
    // 本周一 HK 10-05 00:00 ＝ 10-04T16:00Z。
    expect(weekStartHK(FRI)).toBe(Date.parse("2026-10-04T16:00:00Z"));
  });
  it("连周＋本周无从上周起", () => {
    expect(weekStreak(["2026-10-07", "2026-09-30", "2026-09-24"], FRI)).toBe(3);
    expect(weekStreak(["2026-09-30", "2026-09-24"], FRI)).toBe(2);
    expect(weekStreak(["2026-09-24"], FRI)).toBe(0);
    expect(weekStreak([], FRI)).toBe(0);
  });
  it("本周夜数", () => {
    expect(weekNights(["2026-10-07", "2026-10-09", "2026-09-30"], FRI)).toBe(2);
  });
});

describe("collectNightStats", () => {
  it("夜键＋地点去重；坏输入空集（路由接线回归锁）", () => {
    const rows = [
      { created_at: "2026-10-09T02:00:00Z", place_name: " 中環 " },
      { created_at: "2026-10-09T03:00:00Z", place_name: "中環" },
      { created_at: "2026-10-08T21:00:00Z", place_name: "" },
      { created_at: "乱码", place_name: "x" },
      null,
      { nope: 1 },
    ];
    const { nights, places } = collectNightStats(rows);
    // 10-09T02/03Z＝HK 同一晚；10-08T21Z＝HK 10-09 05:00 算前一晚 10-08。
    expect(nights).toEqual(new Set(["2026-10-09", "2026-10-08"]));
    expect(places).toEqual(new Set(["中環", "x"]));
    expect(collectNightStats({ data: rows })).toEqual({ nights: new Set(), places: new Set() });
    expect(collectNightStats(null)).toEqual({ nights: new Set(), places: new Set() });
  });
});
