import { describe, expect, it } from "vitest";

import {
  areFriends,
  friendIdsOf,
  hideOnlineForViewer,
  parseAddFriendBody,
  parseCheckUserId,
  parseFriendCheckParams,
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

describe("parseFriendCheckParams (UR A.19)", () => {
  const q = (s: string) => parseFriendCheckParams(new URLSearchParams(s));
  it("user_id 單獨過", () => {
    expect(q("user_id=abc")).toEqual({ target: { userId: "abc" } });
  });
  it("checkin_id 單獨過", () => {
    expect(q("checkin_id=uuid-1")).toEqual({ target: { checkinId: "uuid-1" } });
  });
  it("並存／皆無／超長 → error", () => {
    expect("error" in q("user_id=a&checkin_id=b")).toBe(true);
    expect("error" in q("")).toBe(true);
    expect("error" in q(`checkin_id=${"x".repeat(65)}`)).toBe(true);
  });
});

describe("parseAddFriendBody (DEF-20260926-009)", () => {
  it("friend_id／checkin_id 各自過", () => {
    expect(parseAddFriendBody({ friend_id: "u1" })).toEqual({ body: { friendId: "u1" } });
    expect(parseAddFriendBody({ checkin_id: "c1" })).toEqual({ body: { checkinId: "c1" } });
  });
  it("並存／皆無／非對象 → error", () => {
    expect("error" in parseAddFriendBody({ friend_id: "u", checkin_id: "c" })).toBe(true);
    expect("error" in parseAddFriendBody({})).toBe(true);
    expect("error" in parseAddFriendBody(null)).toBe(true);
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
