import { describe, expect, it } from "vitest";

import {
  areFriends,
  friendIdsOf,
  hideOnlineForViewer,
  parseCheckUserId,
  parseScope,
} from "./friends";

describe("areFriends (UR A.17)", () => {
  const rows = [
    { user_id: "me", friend_id: "a", status: "accepted" },
    { user_id: "b", friend_id: "me", status: "accepted" },
    { user_id: "me", friend_id: "c", status: "pending" },
    { user_id: "me", friend_id: "d", status: "blocked" },
  ];
  it("正向 accepted 算好友", () => {
    expect(areFriends("me", "a", rows)).toBe(true);
  });
  it("反向 accepted 算好友", () => {
    expect(areFriends("me", "b", rows)).toBe(true);
  });
  it("pending／blocked 不算", () => {
    expect(areFriends("me", "c", rows)).toBe(false);
    expect(areFriends("me", "d", rows)).toBe(false);
  });
  it("陌生人／自查不算", () => {
    expect(areFriends("me", "zzz", rows)).toBe(false);
    expect(areFriends("me", "me", rows)).toBe(false);
  });
});

describe("friendIdsOf (UR A.17)", () => {
  it("雙向去重＋排除自己＋略過非 accepted", () => {
    const ids = friendIdsOf("me", [
      { user_id: "me", friend_id: "a", status: "accepted" },
      { user_id: "b", friend_id: "me", status: "accepted" },
      { user_id: "a", friend_id: "me", status: "accepted" },
      { user_id: "me", friend_id: "c", status: "pending" },
      { user_id: "me", friend_id: "me", status: "accepted" },
    ]);
    expect(ids.sort()).toEqual(["a", "b"]);
  });
});

describe("parseCheckUserId / parseScope (UR A.17)", () => {
  it("合法 user_id 過", () => {
    const p = new URLSearchParams("user_id=abc-123");
    const res = parseCheckUserId(p);
    expect("userId" in res && res.userId).toBe("abc-123");
  });
  it("缺 user_id → error", () => {
    expect("error" in parseCheckUserId(new URLSearchParams(""))).toBe(true);
  });
  it("scope 缺省 all／friends 過／非法 error", () => {
    expect(parseScope(null)).toEqual({ scope: "all" });
    expect(parseScope("friends")).toEqual({ scope: "friends" });
    expect("error" in parseScope("everyone")).toBe(true);
  });
});

describe("hideOnlineForViewer (UR A.17)", () => {
  it("friends 作者對非好友藏綠點，好友可見", () => {
    expect(hideOnlineForViewer("friends", "a", "me", [])).toBe(true);
    expect(hideOnlineForViewer("friends", "a", "me", ["a"])).toBe(false);
  });
  it("public／未知作者不藏；自己看自己不藏", () => {
    expect(hideOnlineForViewer("public", "a", "me", [])).toBe(false);
    expect(hideOnlineForViewer(null, "a", "me", [])).toBe(false);
    expect(hideOnlineForViewer("friends", "me", "me", [])).toBe(false);
  });
});
