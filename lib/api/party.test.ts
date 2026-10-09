import { describe, expect, it } from "vitest";

import { countGenders, hkDayStartISO, mineOrCondition, parsePartyBody, partyExpiresAt, partyJoinState, partyMixLine, partyMixText, partyProgress, partyRemainText, partySlotStartAt, seatFor } from "./party";

describe("parsePartyBody", () => {
  const NOW = Date.parse("2026-10-08T00:00:00Z");
  const good = {
    place: " 中環 Soho ",
    city: "中環",
    lat: 22.28,
    lng: 114.15,
    start_at: "2026-10-08T13:00:00Z",
    seats_total: 6,
    seats_male: 2,
    seats_female: 2,
    min_members: 2,
    bill_intent: "aa",
  };
  it("收全段（去空白，默認值透传）", () => {
    const r = parsePartyBody(good, NOW);
    expect(r).not.toHaveProperty("error");
    if ("error" in r) throw new Error("unreachable");
    expect(r.body.place).toBe("中環 Soho");
    expect(r.body.min_members).toBe(2);
  });
  it("總量 2–12／名額和≤總量／門檻 2..總量／14 天拒", () => {
    expect(parsePartyBody({ ...good, seats_total: 13 }, NOW)).toHaveProperty("error");
    expect(parsePartyBody({ ...good, seats_male: 4, seats_female: 4 }, NOW)).toHaveProperty("error");
    expect(parsePartyBody({ ...good, min_members: 7 }, NOW)).toHaveProperty("error");
    expect(parsePartyBody({ ...good, min_members: 1 }, NOW)).toHaveProperty("error");
    expect(parsePartyBody({ ...good, start_at: "2026-10-30T00:00:00Z" }, NOW)).toHaveProperty("error");
    expect(parsePartyBody({ ...good, start_at: "2026-10-07T00:00:00Z" }, NOW)).toHaveProperty("error");
    expect(parsePartyBody({ ...good, bill_intent: "boss" }, NOW)).toHaveProperty("error");
    expect(parsePartyBody({ ...good, place: "  " }, NOW)).toHaveProperty("error");
  });
});

describe("partyExpiresAt", () => {
  it("開始＋3h（散席宽限）", () => {
    const t = Date.parse("2026-10-08T13:00:00Z");
    expect(partyExpiresAt(t)).toBe(t + 3 * 3600_000);
  });
});

describe("hkDayStartISO", () => {
  it("HK 自然天 0 点（UTC 回吐）", () => {
    // 2026-10-08T01:00Z ＝ HK 09:00 → 當天 00:00HKT ＝ 前日 16:00Z。
    expect(hkDayStartISO(Date.parse("2026-10-08T01:00:00Z"))).toBe("2026-10-07T16:00:00.000Z");
  });
});

describe("seatFor", () => {
  // total 6：男专 2／女专 2／开放 2。
  const seats = { total: 6, male: 2, female: 2 };
  it("本性别专用席优先", () => {
    expect(seatFor("male", { total: 1, male: 1, female: 0 }, seats)).toEqual({ ok: true });
    expect(seatFor("female", { total: 1, male: 0, female: 1 }, seats)).toEqual({ ok: true });
  });
  it("专用满走开放；开放满即 gender_full", () => {
    expect(seatFor("male", { total: 2, male: 2, female: 0 }, seats)).toEqual({ ok: true });
    expect(seatFor("male", { total: 3, male: 2, female: 0 }, seats)).toEqual({ ok: true });
    // 男专满＋开放 2 被占满（总数 5<6 未满）→ 男 gender_full
    expect(seatFor("male", { total: 5, male: 2, female: 1 }, seats)).toEqual({
      ok: false,
      code: "gender_full",
    });
  });
  it("secret 只走开放席", () => {
    expect(seatFor("secret", { total: 0, male: 0, female: 0 }, seats)).toEqual({ ok: true });
    expect(seatFor(null, { total: 5, male: 2, female: 1 }, seats)).toEqual({
      ok: false,
      code: "gender_full",
    });
  });
  it("总数满即 party_full", () => {
    expect(seatFor("male", { total: 6, male: 2, female: 2 }, seats)).toEqual({
      ok: false,
      code: "party_full",
    });
  });
});

describe("countGenders", () => {
  it("男女分计；secret／null／未知不计", () => {
    expect(countGenders(["male", "female", "male"])).toEqual({ male: 2, female: 1 });
    expect(countGenders(["secret", null, "other", ""])).toEqual({ male: 0, female: 0 });
    expect(countGenders([])).toEqual({ male: 0, female: 0 });
  });
});

describe("partyProgress", () => {
  it("0–1 钳制；非法回 0", () => {
    expect(partyProgress(3, 6)).toBe(0.5);
    expect(partyProgress(9, 6)).toBe(1);
    expect(partyProgress(0, 0)).toBe(0);
    expect(partyProgress(-1, 6)).toBe(0);
  });
});

describe("partyMixLine", () => {  it("构成＋余量；零值省略；無配額沿舊", () => {
    expect(partyMixText(3, 2)).toBe("3男 2女");
    expect(partyMixText(0, 0)).toBe("");
    expect(partyRemainText(2, 2, 2, 2)).toBeNull();
    expect(partyRemainText(0, 0, 0, 0)).toBeNull();
    expect(partyMixLine(3, 2, 2, 2)).toBe("3男 2女");
    expect(partyMixLine(1, 0, 2, 2)).toBe("1男 · 還差1男 還差2女");
    expect(partyMixLine(0, 0, 2, 0)).toBe("還差2男");
  });
});

describe("partyJoinState", () => {
  it("cancelled＞host＞joined＞full＞joinable", () => {
    expect(partyJoinState("cancelled", true, true, 9, 9)).toBe("cancelled");
    expect(partyJoinState("open", true, false, 0, 6)).toBe("host");
    expect(partyJoinState("open", false, true, 3, 6)).toBe("joined");
    expect(partyJoinState("open", false, false, 6, 6)).toBe("full");
    expect(partyJoinState("open", false, false, 2, 6)).toBe("joinable");
  });
});

describe("partySlotStartAt", () => {
  // 2026-10-09T10:00Z ＝ HK 18:00（未过 21:00，tonight 取当天）。
  const NOW = Date.parse("2026-10-09T10:00:00Z");
  it("now／half／custom 直给；tonight 取 HK 21:00", () => {
    expect(partySlotStartAt("now", 0, NOW)).toBe(NOW);
    expect(partySlotStartAt("half", 0, NOW)).toBe(NOW + 30 * 60_000);
    expect(partySlotStartAt("custom", NOW + 3600_000, NOW)).toBe(NOW + 3600_000);
    expect(partySlotStartAt("tonight", 0, NOW)).toBe(Date.parse("2026-10-09T13:00:00Z"));
  });
  it("过 21:00 即次日", () => {
    const late = Date.parse("2026-10-09T14:00:00Z"); // HK 22:00
    expect(partySlotStartAt("tonight", 0, late)).toBe(Date.parse("2026-10-10T13:00:00Z"));
  });
});

describe("mineOrCondition", () => {
  it("空参加只查发起；去重＋剔空串", () => {
    expect(mineOrCondition("u1", [])).toBe("host_user_id.eq.u1");
    expect(mineOrCondition("u1", ["a", "a", "", "b"])).toBe("host_user_id.eq.u1,id.in.(a,b)");
  });
});
