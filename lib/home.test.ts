import { describe, expect, it } from "vitest";

import { parseHomeUi, resolveHomeTarget } from "./home";

describe("parseHomeUi (UR C.7)", () => {
  it("只有字面 v1 才退出 v2", () => {
    expect(parseHomeUi("v1")).toBe("v1");
    expect(parseHomeUi("v2")).toBe("v2");
  });

  it("缺省／非法一律 v2（用戶拍板）", () => {
    expect(parseHomeUi(undefined)).toBe("v2");
    expect(parseHomeUi(null)).toBe("v2");
    expect(parseHomeUi("")).toBe("v2");
    expect(parseHomeUi("V1")).toBe("v2");
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
});
