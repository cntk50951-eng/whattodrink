import { describe, expect, it } from "vitest";

import {
  isWriteBlocked,
  parseMode,
  parsePatchModeBody,
  toMeJson,
} from "./mode";

describe("parseMode (UR A.16)", () => {
  it("三檔全過", () => {
    expect(parseMode("stealth")).toBe("stealth");
    expect(parseMode("friends")).toBe("friends");
    expect(parseMode("public")).toBe("public");
  });
  it("非法／空值回 null", () => {
    expect(parseMode("invisible")).toBeNull();
    expect(parseMode(null)).toBeNull();
    expect(parseMode(undefined)).toBeNull();
    expect(parseMode(42)).toBeNull();
  });
});

describe("parsePatchModeBody (UR A.16)", () => {
  it("合法 mode 過", () => {
    const res = parsePatchModeBody({ mode: "stealth" });
    expect("body" in res && res.body.mode).toBe("stealth");
  });
  it("非法 mode → error", () => {
    expect("error" in parsePatchModeBody({ mode: "ghost" })).toBe(true);
  });
  it("缺 mode／非對象 → error", () => {
    expect("error" in parsePatchModeBody({})).toBe(true);
    expect("error" in parsePatchModeBody(null)).toBe(true);
    expect("error" in parsePatchModeBody("stealth")).toBe(true);
  });
});

describe("isWriteBlocked (UR A.16)", () => {
  it("stealth 攔截", () => {
    expect(isWriteBlocked("stealth")).toBe(true);
  });
  it("friends／public／未知不攔", () => {
    expect(isWriteBlocked("friends")).toBe(false);
    expect(isWriteBlocked("public")).toBe(false);
    expect(isWriteBlocked(null)).toBe(false);
  });
});

describe("toMeJson (UR A.16)", () => {
  it("完整行過", () => {
    const row = toMeJson({
      id: "u1",
      nickname: "阿怡",
      avatar_url: null,
      gender: "female",
      mode: "friends",
      mode_updated_at: "2026-09-26T00:00:00Z",
    });
    expect(row?.mode).toBe("friends");
    expect(row?.nickname).toBe("阿怡");
  });
  it("缺 mode 列按 public 回退（0007 未遷移）", () => {
    const row = toMeJson({
      id: "u1",
      nickname: "阿怡",
      avatar_url: null,
      gender: "secret",
      mode_updated_at: "2026-09-26T00:00:00Z",
    });
    expect(row?.mode).toBe("public");
  });
  it("壞行回 null（缺 id／壞時間／非法 gender）", () => {
    expect(
      toMeJson({
        nickname: "x",
        avatar_url: null,
        gender: "secret",
        mode: "public",
        mode_updated_at: "2026-09-26T00:00:00Z",
      }),
    ).toBeNull();
    expect(
      toMeJson({
        id: "u1",
        nickname: "x",
        avatar_url: null,
        gender: "secret",
        mode: "public",
        mode_updated_at: "not-a-date",
      }),
    ).toBeNull();
    expect(
      toMeJson({
        id: "u1",
        nickname: "x",
        avatar_url: null,
        gender: "other",
        mode: "public",
        mode_updated_at: "2026-09-26T00:00:00Z",
      }),
    ).toBeNull();
  });
});
