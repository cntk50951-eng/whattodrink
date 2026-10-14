import { describe, expect, it } from "vitest";

import {
  activityBell,
  noticeActorName,
  noticeDetail,
  noticeIcon,
  noticePlace,
  noticeTitle,
  noticeUrgent,
  parseFriendRequest,
  parseNotice,
} from "./activity";

describe("parseNotice", () => {
  it("壞行回 null", () => {
    expect(parseNotice(null)).toBeNull();
    expect(parseNotice({})).toBeNull();
    expect(parseNotice({ id: "x" })).toBeNull();
  });
  it("正常行＋read 映射", () => {
    const n = parseNotice({
      id: "1",
      kind: "member_left",
      party_id: "p",
      actor: { user_id: "u", nickname: " Mandy ", avatar_url: null },
      payload: { party_place: "Bar X", start_at: "2026-10-14T20:00:00+08:00" },
      created_at: "2026-10-14T19:00:00+08:00",
      read_at: null,
    });
    expect(n?.read).toBe(false);
    expect(noticePlace(n!, "酒局")).toBe("Bar X");
    expect(noticeActorName(n!, "酒友")).toBe("Mandy");
  });
  it("兜底：空名回 fallback", () => {
    const n = parseNotice({ id: "1", kind: "party_cancelled", payload: {} });
    expect(noticePlace(n!, "酒局")).toBe("酒局");
    expect(noticeActorName(n!, "酒友")).toBe("酒友");
  });
});

describe("noticeTitle", () => {
  it("撤銷／退出／臨近退出", () => {
    const c = parseNotice({ id: "1", kind: "party_cancelled", payload: {} })!;
    expect(noticeTitle(c, "Bar", "M")).toEqual({ key: "noticeTitleCancelled", params: { place: "Bar" } });
    const l = parseNotice({ id: "2", kind: "member_left", payload: {} })!;
    expect(noticeTitle(l, "Bar", "Mandy")).toEqual({ key: "noticeTitleLeft", params: { actor: "Mandy", place: "Bar" } });
    const ll = parseNotice({ id: "3", kind: "member_left_late", payload: { minutes_before_start: 30 } })!;
    expect(noticeTitle(ll, "Bar", "Mandy")).toEqual({
      key: "noticeTitleLeftLate",
      params: { actor: "Mandy", minutes: 30, place: "Bar" },
    });
    const ll2 = parseNotice({ id: "4", kind: "member_left_late", payload: {} })!;
    expect(noticeTitle(ll2, "Bar", "Mandy").key).toBe("noticeTitleLeftLateSoon");
  });
  it("誠信正負兩 key", () => {
    const up = parseNotice({ id: "1", kind: "trust_changed", payload: { delta: 2 } })!;
    expect(noticeTitle(up, "酒局", "酒友")).toEqual({ key: "noticeTitleTrustUp", params: { num: 2 } });
    const dn = parseNotice({ id: "2", kind: "trust_changed", payload: { delta: -6 } })!;
    expect(noticeTitle(dn, "酒局", "酒友")).toEqual({ key: "noticeTitleTrustDown", params: { num: 6 } });
  });
  it("未知 kind 兜底不丟", () => {
    const n = parseNotice({ id: "1", kind: "future_kind_xyz", payload: {} })!;
    expect(noticeTitle(n, "酒局", "酒友")).toEqual({ key: "noticeTitleDefault" });
    expect(noticeIcon(n)).toBe("bell");
    expect(noticeUrgent(n)).toBe(false);
  });
});

describe("noticeDetail", () => {
  it("開局時間／申辯截止／信任原因", () => {
    const r = parseNotice({ id: "1", kind: "reminder_1h", payload: { start_at: "2026-10-14T20:00:00+08:00" } })!;
    expect(noticeDetail(r)).toEqual({ kind: "startsAt", startAt: "2026-10-14T20:00:00+08:00" });
    const t = parseNotice({ id: "2", kind: "trust_changed", payload: { delta: -3, reason_text: "臨時退出", new_tier: "watch" } })!;
    expect(noticeDetail(t)).toEqual({ kind: "trust", reason: "臨時退出", tier: "watch" });
  });
});

describe("parseFriendRequest", () => {
  it("壞行／缺 peer 回 null", () => {
    expect(parseFriendRequest(null)).toBeNull();
    expect(parseFriendRequest({ id: "x", user: null })).toBeNull();
  });
  it("正常行＋留言 trim", () => {
    const r = parseFriendRequest({
      id: "r1",
      user: { user_id: "u1", nickname: "Kelvin", avatar_url: null, gender: "male" },
      origin: "meet",
      message: "  hi  ",
      created_at: "2026-10-14T18:00:00+08:00",
    });
    expect(r?.peer.nickname).toBe("Kelvin");
    expect(r?.message).toBe("hi");
  });
});

describe("activityBell", () => {
  it("四源求和＋負數鉗零", () => {
    expect(activityBell(2, 1, 3, 0)).toBe(6);
    expect(activityBell(-1, 0, 0, 0)).toBe(0);
  });
});
