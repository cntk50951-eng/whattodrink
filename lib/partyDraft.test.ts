import { describe, expect, it } from "vitest";

import {
  applyPrefs,
  blankDraft,
  canReopen,
  draftExpired,
  draftMeaningful,
  parseDraft,
  parsePrefs,
  prefsFromDraft,
  reopenDraft,
  restoredStartAt,
  sanitizedDraft,
} from "./partyDraft";

const NOW = Date.parse("2026-10-20T12:00:00+08:00");

describe("draft", () => {
  it("空表單無意義不存", () => {
    expect(draftMeaningful(blankDraft(NOW))).toBe(false);
    expect(draftMeaningful({ ...blankDraft(NOW), city: "HK" })).toBe(true);
  });
  it("7 天過期", () => {
    expect(draftExpired(NOW - 8 * 24 * 3600_000, NOW)).toBe(true);
    expect(draftExpired(NOW - 6 * 24 * 3600_000, NOW)).toBe(false);
  });
  it("席位消毒退回默認", () => {
    const s = sanitizedDraft({ ...blankDraft(NOW), totalSeats: 5, maleSeats: 3, femaleSeats: 3, bill: "bogus" });
    expect(s.totalSeats).toBe(6);
    expect(s.bill).toBe("flexible");
  });
  it("時間：過去／超窗丟掉", () => {
    expect(restoredStartAt({ ...blankDraft(NOW), startAt: NOW - 1000 }, NOW)).toBeNull();
    expect(restoredStartAt({ ...blankDraft(NOW), startAt: NOW + 20 * 24 * 3600_000 }, NOW)).toBeNull();
    const ok = NOW + 2 * 3600_000;
    expect(restoredStartAt({ ...blankDraft(NOW), startAt: ok }, NOW)).toBe(ok);
  });
  it("反序列化壞形 null", () => {
    expect(parseDraft("not-json", NOW)).toBeNull();
    expect(parseDraft(null, NOW)).toBeNull();
    const d = parseDraft(
      JSON.stringify({ bar: { name: "Bar", lat: 22.3, lng: 114.1 }, city: "HK", startAt: NOW + 3600_000, savedAt: NOW }),
      NOW,
    );
    expect(d?.bar?.name).toBe("Bar");
  });
});

describe("prefs/reopen", () => {
  it("記住上次＋套用", () => {
    const d = { ...blankDraft(NOW), city: "HK", totalSeats: 8, bill: "aa" };
    const p = prefsFromDraft(d, Date.parse("2026-10-20T21:30:00+08:00"));
    expect(p.usualHour).toBe(21);
    expect(p.usualMinute).toBe(30);
    const applied = applyPrefs(p, NOW);
    expect(applied.city).toBe("HK");
    expect(applied.totalSeats).toBe(8);
    expect(parsePrefs(null)).toBeNull();
  });
  it("再開一局＋可開判定", () => {
    const d = reopenDraft(
      { place: "Bar", city: "HK", lat: 22.3, lng: 114.1, seats_total: 8, seats_male: 2, seats_female: 2, bill_intent: "host" },
      NOW,
    );
    expect(d.bar?.name).toBe("Bar");
    expect(d.startAt).toBeNull();
    expect(canReopen(true, "cancelled", NOW, NOW)).toBe(true);
    expect(canReopen(true, "open", NOW + 1000, NOW)).toBe(false);
    expect(canReopen(true, "open", NOW - 1000, NOW)).toBe(true);
    expect(canReopen(false, "cancelled", NOW, NOW)).toBe(false);
  });
});
