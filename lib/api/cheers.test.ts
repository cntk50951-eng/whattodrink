import { describe, expect, it } from "vitest";

import { cheersQuota, isMinorDob, parseCheersBody, parseCheersMessage } from "./cheers";

describe("parseCheersBody", () => {
  it("checkin_id｜to_user_id 二选一收", () => {
    expect(parseCheersBody({ checkin_id: "abc-1" })).toEqual({ checkin_id: "abc-1" });
    expect(parseCheersBody({ to_user_id: "u-1" })).toEqual({ to_user_id: "u-1" });
  });
  it("双给／双空／异形／非对象拒", () => {
    expect(parseCheersBody({ checkin_id: "a", to_user_id: "b" })).toHaveProperty("error");
    expect(parseCheersBody({})).toHaveProperty("error");
    expect(parseCheersBody(null)).toHaveProperty("error");
    expect(parseCheersBody({ checkin_id: "../x" })).toHaveProperty("error");
    expect(parseCheersBody({ to_user_id: "" })).toHaveProperty("error");
  });
});

describe("parseCheersMessage", () => {
  it("有字截 200；空／非串即无", () => {
    expect(parseCheersMessage("Cheers！")).toBe("Cheers！");
    expect(parseCheersMessage("  ")).toBeNull();
    expect(parseCheersMessage(null)).toBeNull();
    expect(parseCheersMessage("x".repeat(300))?.length).toBe(200);
  });
});

describe("cheersQuota", () => {
  it("15 封顶；14 即剩 1；脏数按 0", () => {
    expect(cheersQuota(0)).toEqual({ ok: true, remaining: 15 });
    expect(cheersQuota(14)).toEqual({ ok: true, remaining: 1 });
    expect(cheersQuota(15)).toEqual({ ok: false, remaining: 0 });
    expect(cheersQuota(-3)).toEqual({ ok: true, remaining: 15 });
  });
});

describe("isMinorDob", () => {
  const NOW = Date.parse("2026-10-04T00:00:00Z");
  it("未满 18 真；成年／缺席／异形假", () => {
    expect(isMinorDob("2015-01-01", NOW)).toBe(true);
    expect(isMinorDob("2000-01-01", NOW)).toBe(false);
    expect(isMinorDob(null, NOW)).toBe(false);
    expect(isMinorDob("not-a-date", NOW)).toBe(false);
    expect(isMinorDob("2030-01-01", NOW)).toBe(false);
  });
});
