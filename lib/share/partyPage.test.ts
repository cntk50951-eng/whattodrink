import { describe, expect, it } from "vitest";

import { appStoreUrl, isSharePath, partyBillText, partyDeepLink, partyPageState, partyPurposeText, partyShareDescription, partyWhenText } from "./partyPage";

describe("partyPage", () => {
  it("isSharePath：只認 /p/<id>", () => {
    expect(isSharePath("/p/abc-123")).toBe(true);
    expect(isSharePath("/p/abc-123/")).toBe(true);
    expect(isSharePath("/p/")).toBe(false);
    expect(isSharePath("/p/a/b")).toBe(false);
    expect(isSharePath("/parties/abc")).toBe(false);
    expect(isSharePath("/p/a%20b")).toBe(false);
  });
  it("partyDeepLink", () => {
    expect(partyDeepLink("ab-12")).toBe("whattodrink://party/ab-12");
  });
  it("partyWhenText：香港時間", () => {
    // 2026-10-17T13:00:00Z = 香港 21:00
    expect(partyWhenText("2026-10-17T13:00:00Z")).toMatch(/10月17日.*21:00/);
    expect(partyWhenText("bad")).toBe("");
  });
  it("目的／買單文案；未知 key 丟掉", () => {
    expect(partyPurposeText(["social", "zzz", "chill"])).toEqual(["交朋友", "輕鬆飲酒傾偈"]);
    expect(partyPurposeText(null)).toEqual([]);
    expect(partyBillText("aa")).toBe("AA");
    expect(partyBillText("x")).toBe("");
  });
  it("partyShareDescription", () => {
    expect(partyShareDescription({ place: "Bar", start_at: "2026-10-17T13:00:00Z", seats_total: 6, joined: 3, bill_intent: "aa" })).toMatch(/^Bar · 10月17日.*21:00 · 3\/6 人 · AA$/);
  });
  it("partyPageState：撤銷＞結束＞可加入", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    expect(partyPageState({ status: "cancelled", expires_at: "2099-01-01T00:00:00Z" }, now)).toBe("cancelled");
    expect(partyPageState({ status: "open", expires_at: "2026-10-17T11:00:00Z" }, now)).toBe("ended");
    expect(partyPageState({ status: "open", expires_at: "2026-10-17T16:00:00Z" }, now)).toBe("open");
  });
  it("appStoreUrl：只收 https 的 App Store／TestFlight", () => {
    expect(appStoreUrl(undefined)).toBeNull();
    expect(appStoreUrl("  ")).toBeNull();
    expect(appStoreUrl("https://apps.apple.com/hk/app/id123")).toBe("https://apps.apple.com/hk/app/id123");
    expect(appStoreUrl("https://testflight.apple.com/join/abc")).toBe("https://testflight.apple.com/join/abc");
    expect(appStoreUrl("http://apps.apple.com/x")).toBeNull();
    expect(appStoreUrl("https://evil.com/apps.apple.com")).toBeNull();
    expect(appStoreUrl("javascript:alert(1)")).toBeNull();
  });
});
