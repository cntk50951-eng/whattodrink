import { describe, expect, it } from "vitest";

import { parseHomeUi, resolveHomeTarget } from "./home";

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
