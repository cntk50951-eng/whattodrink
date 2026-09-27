import { describe, it, expect } from "vitest";
import { validateGatheringInput, checkRateLimit, type GatheringInput } from "./gatherings";

function base(over: Partial<GatheringInput> = {}): GatheringInput {
  return {
    title: "周末认识新朋友",
    theme: "friend_new",
    description: "想认识爱 CityWalk 的朋友，带什么都欢迎，一起在中环聊聊天",
    location_text: "中环 Soho 某餐吧",
    place_id: "nominatim-123",
    lat: 22.2819,
    lng: 114.158,
    starts_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    capacity: 6,
    visibility: "public",
    approval_mode: "manual",
    bring_text: null,
    age_has_minor: false,
    agreed: true,
    ...over,
  };
}

describe("validateGatheringInput (F.1)", () => {
  it("合规通过", () => {
    expect(validateGatheringInput(base())).toEqual([]);
  });
  it("描述必填", () => {
    const errs = validateGatheringInput(base({ description: "" }));
    expect(errs.some((e) => e.field === "description")).toBe(true);
  });
  it("带的酒非必填", () => {
    expect(validateGatheringInput(base({ bring_text: null }))).toEqual([]);
    expect(validateGatheringInput(base({ bring_text: "" }))).toEqual([]);
  });
  it("地点仅地图选点", () => {
    const errs = validateGatheringInput(base({ place_id: "", lat: NaN, lng: NaN } as unknown as GatheringInput));
    expect(errs.some((e) => e.field === "location")).toBe(true);
  });
  it("年龄申明未选阻断", () => {
    const errs = validateGatheringInput(base({ age_has_minor: null }));
    expect(errs.some((e) => e.field === "age")).toBe(true);
  });
  it("有未成年人直接拒绝", () => {
    const errs = validateGatheringInput(base({ age_has_minor: true }));
    expect(errs.some((e) => e.field === "age" && e.reason.includes("未成年人"))).toBe(true);
  });
  it("时间不在 2h-14天阻断", () => {
    const errs = validateGatheringInput(base({ starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }));
    expect(errs.some((e) => e.field === "time")).toBe(true);
  });
  it("人数边界", () => {
    expect(validateGatheringInput(base({ capacity: 1 })).some((e) => e.field === "capacity")).toBe(true);
    expect(validateGatheringInput(base({ capacity: 9 })).some((e) => e.field === "capacity")).toBe(true);
  });
  it("私宅关键词阻断", () => {
    const errs = validateGatheringInput(base({ location_text: "某私宅 3楼" }));
    expect(errs.some((e) => e.field === "location")).toBe(true);
  });
  it("主题交友聚会为主", () => {
    expect(validateGatheringInput(base({ theme: "friend_new" }))).toEqual([]);
    expect(validateGatheringInput(base({ theme: "unknown" as unknown as GatheringInput["theme"] })).some((e) => e.field === "theme")).toBe(true);
  });
});

describe("checkRateLimit", () => {
  it("周发超限", () => {
    expect(checkRateLimit(2, 0).length).toBe(1);
  });
  it("进行中限 1", () => {
    expect(checkRateLimit(0, 1).length).toBe(1);
  });
});
