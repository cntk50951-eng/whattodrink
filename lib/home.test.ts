import { describe, expect, it } from "vitest";

import {
  isComingSoonPath,
  parseHomeUi,
  parseSiteLive,
  resolveHomeTarget,
  resolveSiteGate,
} from "./home";

describe("parseHomeUi (UR C.7)", () => {
  it("字面 v1／v2 各走各的", () => {
    expect(parseHomeUi("v1")).toBe("v1");
    expect(parseHomeUi("v2")).toBe("v2");
    expect(parseHomeUi("intro")).toBe("intro");
  });

  it("缺省／非法一律 intro（2026-10-23 用戶拍板：主頁默認進介紹頁）", () => {
    expect(parseHomeUi(undefined)).toBe("intro");
    expect(parseHomeUi(null)).toBe("intro");
    expect(parseHomeUi("")).toBe("intro");
    expect(parseHomeUi("V1")).toBe("intro");
  });
});

describe("parseSiteLive (UR L.1)", () => {
  it("缺省／空／非法一律 true（開站，零行為變化）", () => {
    expect(parseSiteLive(undefined)).toBe(true);
    expect(parseSiteLive(null)).toBe(true);
    expect(parseSiteLive("")).toBe(true);
    expect(parseSiteLive("   ")).toBe(true);
    expect(parseSiteLive("yes")).toBe(true);
    expect(parseSiteLive("1")).toBe(true);
    expect(parseSiteLive("TRUE")).toBe(true);
    expect(parseSiteLive("live")).toBe(true);
  });

  it("關站字面大小写＋空白不敏感", () => {
    expect(parseSiteLive("false")).toBe(false);
    expect(parseSiteLive("FALSE")).toBe(false);
    expect(parseSiteLive(" False ")).toBe(false);
    expect(parseSiteLive("0")).toBe(false);
    expect(parseSiteLive("off")).toBe(false);
    expect(parseSiteLive("OFF")).toBe(false);
    expect(parseSiteLive("no")).toBe(false);
    expect(parseSiteLive("closed")).toBe(false);
  });
});

describe("isComingSoonPath (UR L.1)", () => {
  it("本體與 locale 變體放行", () => {
    expect(isComingSoonPath("/coming-soon")).toBe(true);
    expect(isComingSoonPath("/en/coming-soon")).toBe(true);
    expect(isComingSoonPath("/zh-Hans/coming-soon")).toBe(true);
  });

  it("其他路徑不算", () => {
    expect(isComingSoonPath("/")).toBe(false);
    expect(isComingSoonPath("/intro")).toBe(false);
    expect(isComingSoonPath("/v2")).toBe(false);
    expect(isComingSoonPath("/coming-soon/extra")).toBe(false);
  });
});

describe("resolveSiteGate (UR L.1)", () => {
  const locales = ["zh-Hant", "zh-Hans", "en"];

  it("開站一律 null（零行為變化，含 coming-soon 本體）", () => {
    expect(resolveSiteGate("/", true, locales)).toBeNull();
    expect(resolveSiteGate("/wall", true, locales)).toBeNull();
    expect(resolveSiteGate("/coming-soon", true, locales)).toBeNull();
  });

  it("關站：裸 / 與深路徑回 /coming-soon", () => {
    expect(resolveSiteGate("/", false, locales)).toBe("/coming-soon");
    expect(resolveSiteGate("/wall", false, locales)).toBe("/coming-soon");
    expect(resolveSiteGate("/v2", false, locales)).toBe("/coming-soon");
    expect(resolveSiteGate("/p/abc", false, locales)).toBe("/coming-soon");
  });

  it("關站：locale 前綴保留語言", () => {
    expect(resolveSiteGate("/en", false, locales)).toBe("/en/coming-soon");
    expect(resolveSiteGate("/zh-Hans/", false, locales)).toBe("/zh-Hans/coming-soon");
    expect(resolveSiteGate("/zh-Hant/wall", false, locales)).toBe("/zh-Hant/coming-soon");
  });

  it("關站：coming-soon 本體永遠放行（預覽不鎖）", () => {
    expect(resolveSiteGate("/coming-soon", false, locales)).toBeNull();
    expect(resolveSiteGate("/coming-soon/", false, locales)).toBeNull();
    expect(resolveSiteGate("/en/coming-soon", false, locales)).toBeNull();
  });
});

describe("resolveHomeTarget (UR C.7)", () => {
  it("裸 /＋v2 檔回 /v2", () => {
    expect(resolveHomeTarget("/", "", "v2")).toBe("/v2");
  });

  it("v1 檔全直通（null）", () => {
    expect(resolveHomeTarget("/", "", "v1")).toBeNull();
  });

  it("非根路徑不碰", () => {
    expect(resolveHomeTarget("/v2", "", "v2")).toBeNull();
    expect(resolveHomeTarget("/wall", "", "v2")).toBeNull();
  });

  it("v1 深鏈不劫持（查詢串原樣放行）", () => {
    expect(resolveHomeTarget("/", "?pick=1", "v2")).toBeNull();
    expect(resolveHomeTarget("/", "?shoot=1", "v2")).toBeNull();
  });

  it("locale 根帶語言跳（不丟語言）", () => {
    const locales = ["zh-Hant", "zh-Hans", "en"];
    expect(resolveHomeTarget("/zh-Hans", "", "v2", locales)).toBe("/zh-Hans/v2");
    expect(resolveHomeTarget("/en", "", "v2", locales)).toBe("/en/v2");
    expect(resolveHomeTarget("/zh-Hant", "", "v2", locales)).toBe("/zh-Hant/v2");
  });

  it("locale 根尾斜杠與深鏈同規", () => {
    const locales = ["zh-Hant", "zh-Hans", "en"];
    expect(resolveHomeTarget("/zh-Hans/", "", "v2", locales)).toBe("/zh-Hans/v2");
    expect(resolveHomeTarget("/zh-Hans", "?pick=1", "v2", locales)).toBeNull();
  });

  it("未知前綴與子路徑不碰", () => {
    const locales = ["zh-Hant", "zh-Hans", "en"];
    expect(resolveHomeTarget("/fr", "", "v2", locales)).toBeNull();
    expect(resolveHomeTarget("/zh-Hans/wall", "", "v2", locales)).toBeNull();
    expect(resolveHomeTarget("/zh-Hans", "", "v1", locales)).toBeNull();
  });
});

describe("resolveHomeTarget · intro 檔（默認）", () => {
  const locales = ["zh-Hant", "zh-Hans", "en"];

  it("裸 / 回 /intro", () => {
    expect(resolveHomeTarget("/", "", "intro")).toBe("/intro");
  });

  it("locale 根帶語言跳（不丟語言），尾斜杠同規", () => {
    expect(resolveHomeTarget("/en", "", "intro", locales)).toBe("/en/intro");
    expect(resolveHomeTarget("/zh-Hans/", "", "intro", locales)).toBe("/zh-Hans/intro");
  });

  it("深鏈（查詢串）、/intro 自身、/v2 與子路徑都不劫持", () => {
    expect(resolveHomeTarget("/", "?pick=1", "intro")).toBeNull();
    expect(resolveHomeTarget("/", "?shoot=1", "intro")).toBeNull();
    expect(resolveHomeTarget("/intro", "", "intro")).toBeNull();
    expect(resolveHomeTarget("/v2", "", "intro")).toBeNull();
    expect(resolveHomeTarget("/zh-Hans/wall", "", "intro", locales)).toBeNull();
  });
});
