import { describe, expect, it } from "vitest";
import { parsePlanReply, planStreamLine, sanitizePlan, searchPlanPrompt, wantsPlanStream } from "./searchPlan";

describe("searchPlan", () => {
  it("用戶例句：女生＋附近 24 小時酒吧 → 兩個意圖", () => {
    const { intents } = sanitizePlan([
      { type: "people", criteria: { gender: "female", age_max: 29 } },
      { type: "places", keywords: ["酒吧"], near_me: true, radius_m: 3000, open_24h: true },
    ]);
    expect(intents).toHaveLength(2);
    expect(intents[0]).toEqual({ type: "people", criteria: { gender: "female", age_max: 29 } });
    expect(intents[1]).toMatchObject({ type: "places", open_24h: true, near_me: true, radius_m: 3000, keywords: ["酒吧"] });
  });
  it("每類最多一個、最多 4 個、未知類型丟棄、數值夾住", () => {
    const { intents, dropped } = sanitizePlan([
      { type: "places", radius_m: 999999, keywords: ["bar", "a b", "x".repeat(20)] },
      { type: "places" },
      { type: "weird" },
      { type: "parties", when: "tonight" },
      { type: "posts", tags: ["lager", "nope"], hashtags: ["#微醺", "a<b", "微醺"], within_hours: 99999 },
      { type: "people", criteria: { gender: "female", hairy: true } },
      { type: "people" },
    ]);
    expect(intents.map((i) => i.type)).toEqual(["places", "parties", "posts", "people"]);
    const places = intents[0] as Extract<(typeof intents)[number], { type: "places" }>;
    expect(places.radius_m).toBe(20000);
    expect(places.keywords).toEqual(["bar"]);
    const posts = intents[2] as Extract<(typeof intents)[number], { type: "posts" }>;
    expect(posts.tags).toEqual(["lager"]);
    expect(posts.hashtags).toEqual(["微醺"]);
    expect(posts.within_hours).toBe(720);
    expect(dropped).toContain("type:weird");
    expect(dropped).toContain("hairy");
  });
  it("parse：抠 JSON；壞回覆拋錯；ignored 截 5", () => {
    expect(parsePlanReply('好的 {"intents":[{"type":"people"}],"ignored":["a","b","c","d","e","f"]} 完').ignored).toHaveLength(5);
    expect(() => parsePlanReply("no json")).toThrow();
  });
  it("prompt 含規則與例句", () => {
    const p = searchPlanPrompt("gender: male|female").system;
    expect(p).toContain("24小时");
    expect(p).toContain("gender: male|female");
  });
});

describe("計劃進度流", () => {
  it("planStreamLine：每個事件一行 JSON、以換行結尾，能原樣解回來", () => {
    const line = planStreamLine({ event: "stage", stage: "understanding" });
    expect(line.endsWith("\n")).toBe(true);
    expect(line.indexOf("\n")).toBe(line.length - 1);
    expect(JSON.parse(line)).toEqual({ event: "stage", stage: "understanding" });
    const err = JSON.parse(planStreamLine({ event: "error", code: "rate_limited", message: "今日搜尋次數已用完", status: 429 }));
    expect(err).toMatchObject({ event: "error", code: "rate_limited", status: 429 });
  });

  it("wantsPlanStream：body.stream===true 或 Accept 含 ndjson 才走流；其餘（含舊客戶端）不變", () => {
    expect(wantsPlanStream({ query: "x" }, null)).toBe(false);
    expect(wantsPlanStream({ query: "x", stream: "true" }, "application/json")).toBe(false);
    expect(wantsPlanStream({ query: "x", stream: true }, null)).toBe(true);
    expect(wantsPlanStream({ query: "x" }, "Application/X-NDJSON")).toBe(true);
  });
});
