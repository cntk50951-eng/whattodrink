import { describe, expect, it } from "vitest";

import { inviteDisplay, inviteWindow, parseInviteBody } from "./invites";

describe("parseInviteBody", () => {
  it("三段收（place 去空白 1–30 字；对象二选一）", () => {
    expect(parseInviteBody({ to_user_id: "u1", place: " 中環 Soho ", slot: "now" })).toEqual({
      to_user_id: "u1",
      place: "中環 Soho",
      slot: "now",
    });
    expect(parseInviteBody({ checkin_id: "c1", place: "x", slot: "half" })).toEqual({
      checkin_id: "c1",
      place: "x",
      slot: "half",
    });
  });
  it("缺段／空店／异 slot／超长／双对象拒", () => {
    expect(parseInviteBody({ to_user_id: "u1", place: "x", slot: "tomorrow" })).toHaveProperty("error");
    expect(parseInviteBody({ to_user_id: "u1", place: "  ", slot: "now" })).toHaveProperty("error");
    expect(parseInviteBody({ to_user_id: "u1", place: "x".repeat(31), slot: "now" })).toHaveProperty("error");
    expect(parseInviteBody({ place: "x", slot: "now" })).toHaveProperty("error");
    expect(parseInviteBody({ to_user_id: "u1", checkin_id: "c1", place: "x", slot: "now" })).toHaveProperty("error");
  });
});

describe("inviteWindow", () => {
  // 2026-10-04T12:00:00Z ＝ HK 20:00。
  const NOON = Date.parse("2026-10-04T12:00:00Z");
  it("now 即时 2h 窗", () => {
    expect(inviteWindow("now", NOON)).toEqual({ startAt: NOON, expiresAt: NOON + 2 * 3600_000 });
  });
  it("half 晚半小时起 2h 窗", () => {
    const w = inviteWindow("half", NOON);
    expect(w.startAt - NOON).toBe(30 * 60_000);
    expect(w.expiresAt - w.startAt).toBe(2 * 3600_000);
  });
  it("tonight 今晚 21:00（HK）3h 窗；过 21 点即次日", () => {
    const w = inviteWindow("tonight", NOON);
    expect(new Date(w.startAt).toISOString()).toBe("2026-10-04T13:00:00.000Z");
    expect(w.expiresAt - w.startAt).toBe(3 * 3600_000);
    const late = inviteWindow("tonight", Date.parse("2026-10-04T14:00:00Z"));
    expect(new Date(late.startAt).toISOString()).toBe("2026-10-05T13:00:00.000Z");
  });
});

describe("inviteDisplay", () => {
  it("终态直译；过期即 over；24h 未回应", () => {
    const t0 = 1_000_000;
    expect(inviteDisplay("accepted", null, t0, t0)).toBe("accepted");
    expect(inviteDisplay("recalled", null, t0, t0)).toBe("recalled");
    expect(inviteDisplay("declined", null, t0, t0)).toBe("declined");
    expect(inviteDisplay("sent", t0 + 1000, t0, t0 + 2000)).toBe("over");
    expect(inviteDisplay("sent", null, t0, t0 + 25 * 3600_000)).toBe("noReply");
    expect(inviteDisplay("sent", null, t0, t0 + 3600_000)).toBe("waiting");
  });
});
