import { describe, expect, it } from "vitest";

import {
  checkinVisibilityFor,
  friendsOnlyCountOf,
  parseSavesVisibility,
  parseVisibility,
  savesAccess,
  visibleRowsFor,
} from "./privacy";

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

describe("checkinVisibilityFor 用户默认可见性（0062）", () => {
  it("设了就用设置；没设（null／非法）跟随模式", () => {
    expect(checkinVisibilityFor("public", "friends")).toBe("friends");
    expect(checkinVisibilityFor("friends", "public")).toBe("public");
    expect(checkinVisibilityFor("public", "private")).toBe("private");
    expect(checkinVisibilityFor("friends", null)).toBe("friends");
    expect(checkinVisibilityFor("friends", "bogus")).toBe("friends");
    expect(checkinVisibilityFor("public", undefined)).toBe("public");
  });
  it("隐身永远 private，压过任何设置", () => {
    expect(checkinVisibilityFor("stealth", "public")).toBe("private");
    expect(checkinVisibilityFor("stealth", "friends")).toBe("private");
  });
});

describe("parseVisibility／parseSavesVisibility", () => {
  it("白名单；收藏缺省 friends", () => {
    expect(parseVisibility("public")).toBe("public");
    expect(parseVisibility("x")).toBeNull();
    expect(parseVisibility(null)).toBeNull();
    expect(parseSavesVisibility(undefined)).toBe("friends");
    expect(parseSavesVisibility("bogus")).toBe("friends");
    expect(parseSavesVisibility("private")).toBe("private");
  });
});

describe("savesAccess（收藏门，0062）", () => {
  it("本人永远 allow", () => {
    expect(savesAccess("private", true, false)).toBe("allow");
  });
  it("public：陌生人也 allow", () => {
    expect(savesAccess("public", false, false)).toBe("allow");
    expect(savesAccess("public", false, true)).toBe("allow");
  });
  it("friends（默认，旧行为）：好友 allow，陌生人 forbidden", () => {
    expect(savesAccess("friends", false, true)).toBe("allow");
    expect(savesAccess("friends", false, false)).toBe("forbidden");
  });
  it("private：好友得空列表（不暴露设置），陌生人 forbidden", () => {
    expect(savesAccess("private", false, true)).toBe("empty");
    expect(savesAccess("private", false, false)).toBe("forbidden");
  });
});
