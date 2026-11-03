import { describe, expect, it } from "vitest";

import {
  buildSuggestionPrompt,
  hkDay,
  hkHour,
  pickSuggestionLang,
  sanitizeSuggestions,
  statsFromCheckins,
  SUGGESTION_MAX,
} from "./meetSuggestions";

describe("pickSuggestionLang", () => {
  it("按 Accept-Language 挑語言，認不出走繁體", () => {
    expect(pickSuggestionLang("en-US,en;q=0.9")).toBe("en");
    expect(pickSuggestionLang("zh-Hans-CN")).toBe("zh-Hans");
    expect(pickSuggestionLang("zh-CN")).toBe("zh-Hans");
    expect(pickSuggestionLang("zh-Hant-HK")).toBe("zh-Hant");
    expect(pickSuggestionLang("fr")).toBe("zh-Hant");
    expect(pickSuggestionLang(null)).toBe("zh-Hant");
  });
});

describe("sanitizeSuggestions", () => {
  const good = (n: number) =>
    JSON.stringify({ suggestions: Array.from({ length: n }, (_, i) => ({ text: `週末想搵酒局${i + 1}`, icon: "wineglass" })) });

  it("正常回覆：截到 4 條、帶日期序號 id", () => {
    const out = sanitizeSuggestions(good(6), "2026-11-03");
    expect(out).toHaveLength(SUGGESTION_MAX);
    expect(out?.[0]).toEqual({ id: "2026-11-03-1", text: "週末想搵酒局1", icon: "wineglass" });
  });

  it("容忍 ```json 圍欄與前後廢話", () => {
    expect(sanitizeSuggestions("```json\n" + good(3) + "\n```", "d")).toHaveLength(3);
    expect(sanitizeSuggestions("好的：\n" + good(3) + "\n以上", "d")).toHaveLength(3);
  });

  it("不認識的圖標換 sparkles；重複、超長、含網址／長數字的丟棄", () => {
    const raw = JSON.stringify({
      suggestions: [
        { text: "附近 24 小時酒吧", icon: "hack.icon" },
        { text: "附近 24 小時酒吧", icon: "wineglass" },
        { text: "x".repeat(31), icon: "wineglass" },
        { text: "加我 https://evil.example", icon: "wineglass" },
        { text: "打 91234567 搵我", icon: "wineglass" },
        { text: "喜歡拉格啤酒嘅女生", icon: "person.2.fill" },
        { text: "今晚有咩酒局", icon: "party.popper.fill" },
      ],
    });
    const out = sanitizeSuggestions(raw, "d");
    expect(out?.map((x) => x.text)).toEqual(["附近 24 小時酒吧", "喜歡拉格啤酒嘅女生", "今晚有咩酒局"]);
    expect(out?.[0].icon).toBe("sparkles");
  });

  it("不足 3 條或不是 JSON → null（整批作廢，保留昨天那批）", () => {
    expect(sanitizeSuggestions(good(2), "d")).toBeNull();
    expect(sanitizeSuggestions("抱歉我做不到", "d")).toBeNull();
    expect(sanitizeSuggestions('{"suggestions":"x"}', "d")).toBeNull();
  });
});

describe("統計與提示詞", () => {
  it("熱門地點取頻次前列；晚間占比按香港時間", () => {
    const rows = [
      { place_name: "Bar A", created_at: "2026-11-01T14:00:00Z" }, // HK 22:00 晚間
      { place_name: "Bar A", created_at: "2026-11-01T02:00:00Z" }, // HK 10:00
      { place_name: "Bar B", created_at: "2026-11-01T16:30:00Z" }, // HK 00:30 晚間
      { place_name: null, created_at: null },
    ];
    const s = statsFromCheckins(rows, hkHour);
    expect(s.topPlaces).toEqual(["Bar A", "Bar B"]);
    expect(s.checkinCount).toBe(4);
    expect(s.nightShare).toBe(0.5);
  });

  it("提示詞不含個人資料欄位，只有聚合；空資料也能生成", () => {
    const { system, user } = buildSuggestionPrompt("en", { topPlaces: [], checkinCount: 0, nightShare: 0 });
    expect(system).toContain("English");
    expect(user).toContain("（暫無）");
    expect(user).not.toMatch(/user_id|email/i);
  });

  it("hkDay 用香港日期（UTC 16:30 已是次日）", () => {
    expect(hkDay(new Date("2026-11-02T16:30:00Z"))).toBe("2026-11-03");
    expect(hkDay(new Date("2026-11-02T10:00:00Z"))).toBe("2026-11-02");
  });
});
