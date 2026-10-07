import { describe, expect, it } from "vitest";

import { inviteDisplay, inviteWindow, parseInviteBody } from "./invites";

describe("parseInviteBody", () => {
  it("三段收（place 去空白 1–30 字；对象二选一；bill 必填）", () => {
    expect(
      parseInviteBody({ to_user_id: "u1", place: " 中環 Soho ", slot: "now", bill_intent: "aa" }),
    ).toEqual({
      to_user_id: "u1",
      place: "中環 Soho",
      slot: "now",
      bill_intent: "aa",
    });
    expect(parseInviteBody({ checkin_id: "c1", place: "x", slot: "half", bill_intent: "host" })).toEqual({
      checkin_id: "c1",
      place: "x",
      slot: "half",
      bill_intent: "host",
    });
  });
  it("缺段／空店／异 slot／超长／双对象拒", () => {
    expect(parseInviteBody({ to_user_id: "u1", place: "x", slot: "tomorrow", bill_intent: "aa" })).toHaveProperty("error");
    expect(parseInviteBody({ to_user_id: "u1", place: "  ", slot: "now", bill_intent: "aa" })).toHaveProperty("error");
    expect(parseInviteBody({ to_user_id: "u1", place: "x".repeat(31), slot: "now", bill_intent: "aa" })).toHaveProperty("error");
    expect(parseInviteBody({ place: "x", slot: "now", bill_intent: "aa" })).toHaveProperty("error");
    expect(parseInviteBody({ to_user_id: "u1", checkin_id: "c1", place: "x", slot: "now", bill_intent: "aa" })).toHaveProperty("error");
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

describe("parseInviteBody bill/custom/poi (iOS round-2)", () => {
  const NOW = Date.parse("2026-10-07T00:00:00Z");
  const base = { to_user_id: "u1", place: "x", slot: "now" as const };
  it("bill 必填三选；缺即 400", () => {
    expect(parseInviteBody({ ...base }, NOW)).toHaveProperty("error");
    expect(parseInviteBody({ ...base, bill_intent: "aa" }, NOW)).not.toHaveProperty("error");
    expect(parseInviteBody({ ...base, bill_intent: "boss" }, NOW)).toHaveProperty("error");
  });
  it("custom 要 custom_time（未来 14 天内；过期／超窗／缺席拒）", () => {
    const ok = parseInviteBody(
      { ...base, slot: "custom", bill_intent: "host", custom_time: "2026-10-08T12:00:00Z" },
      NOW,
    );
    expect(ok).not.toHaveProperty("error");
    expect(parseInviteBody({ ...base, slot: "custom", bill_intent: "host" }, NOW)).toHaveProperty("error");
    expect(
      parseInviteBody(
        { ...base, slot: "custom", bill_intent: "host", custom_time: "2026-10-06T12:00:00Z" },
        NOW,
      ),
    ).toHaveProperty("error");
    expect(
      parseInviteBody(
        { ...base, slot: "custom", bill_intent: "host", custom_time: "2026-10-22T12:00:00Z" },
        NOW,
      ),
    ).toHaveProperty("error");
  });
  it("poi 可选 ≤64（异形拒；他档忽略 custom_time 不炸）", () => {
    expect(
      parseInviteBody({ ...base, bill_intent: "flexible", poi_id: "ChIJ123_abc-9" }, NOW),
    ).not.toHaveProperty("error");
    expect(parseInviteBody({ ...base, bill_intent: "flexible", poi_id: "../x" }, NOW)).toHaveProperty(
      "error",
    );
    expect(
      parseInviteBody({ ...base, bill_intent: "flexible", custom_time: "1999-01-01T00:00:00Z" }, NOW),
    ).not.toHaveProperty("error");
  });
});

describe("inviteWindow custom", () => {
  it("custom 取传入时刻＋3h 窗", () => {
    const t = Date.parse("2026-10-08T12:00:00Z");
    expect(inviteWindow("custom", 0, t)).toEqual({ startAt: t, expiresAt: t + 3 * 3600_000 });
  });
});
