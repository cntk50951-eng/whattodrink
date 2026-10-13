import { describe, expect, it } from "vitest";

import { decideOutcome, roundDistance50m } from "./settle";

describe("decideOutcome（证据不足不罚）", () => {
  it("到场打卡或 host 标到即 attended", () => {
    expect(decideOutcome({ arrived_at: "2026-10-13T10:00:00Z", host_marked: null })).toBe("attended");
    expect(decideOutcome({ arrived_at: null, host_marked: true })).toBe("attended");
  });
  it("host 标未到即 no_show；双空即 null", () => {
    expect(decideOutcome({ arrived_at: null, host_marked: false })).toBe("no_show");
    expect(decideOutcome({ arrived_at: null, host_marked: null })).toBeNull();
  });
});

describe("roundDistance50m（防反推）", () => {
  it("取整 50m；非法 0", () => {
    expect(roundDistance50m(299)).toBe(300);
    expect(roundDistance50m(301)).toBe(300);
    expect(roundDistance50m(274)).toBe(250);
    expect(roundDistance50m(NaN)).toBe(0);
  });
});
