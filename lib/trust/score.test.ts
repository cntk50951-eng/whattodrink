import { describe, expect, it } from "vitest";

import { TRUST_CONFIG } from "./config";
import { computeTrust, decayedDelta, trustTier } from "./score";

const DAY = 24 * 3600_000;
const NOW = Date.parse("2026-10-13T12:00:00Z");

function row(kind: string, delta: number, ageDays: number, lifeDays: number) {
  const created = NOW - ageDays * DAY;
  return {
    kind,
    delta,
    created_at: new Date(created).toISOString(),
    expires_at: new Date(created + lifeDays * DAY).toISOString(),
  };
}

describe("decayedDelta（线性衰减＋过期归零）", () => {
  it(" halfway 即半值；过期 0；坏行 0", () => {
    expect(decayedDelta(row("x", -6, 45, 90), NOW)).toBeCloseTo(-3, 5);
    expect(decayedDelta(row("x", -6, 90, 90), NOW)).toBe(0);
    expect(decayedDelta(row("x", -6, 120, 90), NOW)).toBe(0);
    expect(decayedDelta({ kind: "x", delta: "bad", created_at: null, expires_at: null }, NOW)).toBe(0);
  });
});

describe("computeTrust（70 基准＋救濟）", () => {
  it("空账 70；负分累减", () => {
    expect(computeTrust([], NOW)).toEqual({ score: 70, completed: 0 });
    const s = computeTrust([row("leave_late", -6, 0, 90)], NOW);
    expect(s.score).toBe(64);
  });
  it("救濟：60 天无违约＋≥3 完成，老违约不计", () => {
    const rows = [
      row("leave_late", -6, 100, 365),
      row("attend", 2, 10, 180),
      row("attend", 2, 20, 180),
      row("attend", 2, 30, 180),
    ];
    expect(computeTrust(rows, NOW).score).toBeGreaterThan(70);
  });
  it("60 天内有违约即无救濟", () => {
    const rows = [row("leave_late", -6, 100, 365), row("leave_3h", -3, 10, 90)];
    expect(computeTrust(rows, NOW).score).toBeLessThan(70);
  });
});

describe("trustTier（边界）", () => {
  it("newbie 不看分；79/80、49/50、29/30 分界", () => {
    expect(trustTier(95, 2)).toBe("newbie");
    expect(trustTier(80, 5)).toBe("trusted");
    expect(trustTier(79, 5)).toBe("normal");
    expect(trustTier(50, 5)).toBe("normal");
    expect(trustTier(49, 5)).toBe("watch");
    expect(trustTier(30, 5)).toBe("watch");
    expect(trustTier(29, 5)).toBe("restricted");
  });
  it("配置常量在场（上线后可调）", () => {
    expect(TRUST_CONFIG.enforce_watch_limit).toBe(false);
    expect(TRUST_CONFIG.enforce_restricted).toBe(false);
    expect(TRUST_CONFIG.weekly_bonus_cap).toBe(6);
  });
});
