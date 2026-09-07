import { describe, expect, it } from "vitest";

import {
  DAILY_CHEERS_LIMIT,
  canCheers,
  cheersRemaining,
  hkTodayKey,
  loadSentToday,
  saveSentToday,
} from "./cheers";

describe("daily cheers quota (UR3.2)", () => {
  it("caps at 15 per user per day", () => {
    expect(DAILY_CHEERS_LIMIT).toBe(15);
  });

  it("keys the day in Hong Kong time, not the device zone", () => {
    // 9-07 00:30 HKT＝9-06 UTC——拿 UTC 会错算成前一天。
    expect(hkTodayKey(new Date("2026-09-06T16:30:00Z"))).toBe("2026-09-07");
  });

  it("allows below the cap and blocks at the cap", () => {
    expect(canCheers([])).toBe(true);
    expect(canCheers(new Array(14).fill("x"))).toBe(true);
    expect(canCheers(new Array(15).fill("x"))).toBe(false);
    expect(canCheers(new Array(99).fill("x"))).toBe(false);
  });

  it("reports the remaining quota clamped at zero", () => {
    expect(cheersRemaining([])).toBe(15);
    expect(cheersRemaining(new Array(14).fill("x"))).toBe(1);
    expect(cheersRemaining(new Array(15).fill("x"))).toBe(0);
    expect(cheersRemaining(new Array(99).fill("x"))).toBe(0);
  });

  it("reads empty on the server (no window) without throwing", () => {
    expect(loadSentToday(new Date())).toEqual([]);
    expect(() => saveSentToday(["a"], new Date())).not.toThrow();
  });
});
