import { describe, expect, it } from "vitest";

import { cheersQuota, parseCheersBody } from "./cheers";

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

describe("cheersQuota", () => {
  it("15 封顶；14 即剩 1；脏数按 0", () => {
    expect(cheersQuota(0)).toEqual({ ok: true, remaining: 15 });
    expect(cheersQuota(14)).toEqual({ ok: true, remaining: 1 });
    expect(cheersQuota(15)).toEqual({ ok: false, remaining: 0 });
    expect(cheersQuota(-3)).toEqual({ ok: true, remaining: 15 });
  });
});
