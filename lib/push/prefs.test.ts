import { describe, expect, it } from "vitest";

import { sumBadge } from "./badge";
import {
  cheersCollapseId,
  cheersMergedTitle,
  fillPushTemplate,
  parsePushPrefs,
  pushPrefsOf,
} from "./prefs";

describe("pushPrefsOf", () => {
  it("缺键默认（stranger_invites 唯 false）；坏形全默认", () => {
    expect(pushPrefsOf(null)).toEqual({
      cheers: true,
      invites: true,
      invite_replies: true,
      chat: true,
      stranger_invites: false,
      stranger_chat: false,
      friends: true,
      party: true,
    });
    expect(pushPrefsOf({ cheers: false, stranger_invites: true })).toEqual({
      cheers: false,
      invites: true,
      invite_replies: true,
      chat: true,
      stranger_invites: true,
      stranger_chat: false,
      friends: true,
      party: true,
    });
  });
});

describe("parsePushPrefs", () => {
  it("整体替换；未知键／非 boolean 400", () => {
    expect(parsePushPrefs({ cheers: false })).toEqual({
      body: {
        cheers: false,
        invites: true,
        invite_replies: true,
        chat: true,
        stranger_invites: false,
        stranger_chat: false,
        friends: true,
        party: true,
      },
    });
    expect(parsePushPrefs({ weed: true })).toHaveProperty("error");
    expect(parsePushPrefs({ chat: "yes" })).toHaveProperty("error");
    expect(parsePushPrefs(null)).toHaveProperty("error");
  });
});

describe("fillPushTemplate／collapse／merge", () => {
  const t = (k: string): string =>
    k === "pushCheersMulti" ? "{n} 個新碰杯" : k;
  it("填空＋collapse 按收件人＋合并 N 含本条", () => {
    expect(fillPushTemplate("{name} 碰咗你杯", { name: "Chloe" })).toBe("Chloe 碰咗你杯");
    expect(cheersCollapseId("u1")).toBe("cheers-u1");
    expect(cheersMergedTitle(0, t)).toBe("1 個新碰杯");
    expect(cheersMergedTitle(2, t)).toBe("3 個新碰杯");
  });
});

describe("sumBadge", () => {
  it("四数相加；非法钳零", () => {
    expect(sumBadge(3, 2, 7)).toEqual({
      cheers_unread: 3,
      invites_pending: 2,
      chat_unread: 7,
      stranger_unread: 0,
      friend_requests_pending: 0,
      badge: 12,
    });
    expect(sumBadge(3, 2, 7, 1)).toEqual({
      cheers_unread: 3,
      invites_pending: 2,
      chat_unread: 7,
      stranger_unread: 1,
      friend_requests_pending: 0,
      badge: 13,
    });
    expect(sumBadge(-1, NaN, 2.7)).toEqual({
      cheers_unread: 0,
      invites_pending: 0,
      chat_unread: 2,
      stranger_unread: 0,
      friend_requests_pending: 0,
      badge: 2,
    });
  });
  it("UR B.3 好友请求数相加（交接 §六-1；非法钳零）", () => {
    expect(sumBadge(1, 1, 1, 1, 2)).toEqual({
      cheers_unread: 1,
      invites_pending: 1,
      chat_unread: 1,
      stranger_unread: 1,
      friend_requests_pending: 2,
      badge: 6,
    });
    expect(sumBadge(0, 0, 0, 0, NaN)).toEqual({
      cheers_unread: 0,
      invites_pending: 0,
      chat_unread: 0,
      stranger_unread: 0,
      friend_requests_pending: 0,
      badge: 0,
    });
  });
});
