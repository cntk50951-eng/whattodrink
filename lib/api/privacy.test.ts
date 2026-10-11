import { describe, expect, it } from "vitest";

import { checkinVisibilityFor, friendsOnlyCountOf, visibleRowsFor } from "./privacy";

describe("checkinVisibilityFor（矩阵 D）", () => {
  it("隐身→private；好友→friends；公开／未知→public", () => {
    expect(checkinVisibilityFor("stealth")).toBe("private");
    expect(checkinVisibilityFor("friends")).toBe("friends");
    expect(checkinVisibilityFor("public")).toBe("public");
    expect(checkinVisibilityFor(null)).toBe("public");
    expect(checkinVisibilityFor(undefined)).toBe("public");
  });
});

describe("visibleRowsFor（矩阵 C 足迹）", () => {
  const rows = [
    { id: "p", visibility: "public" },
    { id: "f", visibility: "friends" },
    { id: "x", visibility: "private" },
  ];
  it("本人全见（含 private）", () => {
    expect(visibleRowsFor("me", "me", rows, []).map((r) => r.id)).toEqual(["p", "f", "x"]);
  });
  it("好友：public＋friends，private 永不见", () => {
    expect(visibleRowsFor("v", "o", rows, ["o"]).map((r) => r.id)).toEqual(["p", "f"]);
  });
  it("陌生人：只有 public", () => {
    expect(visibleRowsFor("v", "o", rows, []).map((r) => r.id)).toEqual(["p"]);
  });
});

describe("friendsOnlyCountOf（陌生人「另有 N 条」）", () => {
  it("只数 friends，不含 private", () => {
    expect(
      friendsOnlyCountOf([
        { visibility: "public" },
        { visibility: "friends" },
        { visibility: "friends" },
        { visibility: "private" },
      ]),
    ).toBe(2);
  });
  it("无 friends 行即 0", () => {
    expect(friendsOnlyCountOf([{ visibility: "private" }])).toBe(0);
  });
});
