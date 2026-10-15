import { describe, expect, it } from "vitest";
import { buildPublicTrustDetail, monthlyAttend, trustBreakdown, trustTrend, upheld180d } from "./publicDetail";

const NOW = Date.parse("2026-10-15T04:00:00Z");
const DAY = 24 * 3600_000;
const iso = (t: number) => new Date(t).toISOString();
const row = (kind: string, delta: number, ageDays: number, lifeDays = 90) => ({
  kind, delta, created_at: iso(NOW - ageDays * DAY), expires_at: iso(NOW - ageDays * DAY + lifeDays * DAY),
});

describe("trustBreakdown", () => {
  it("groups active events by kind, positives first, hides filer-side and refund kinds", () => {
    const rows = [
      row("attend", 2, 1), row("attend", 2, 10), row("hosted_completed", 3, 5),
      row("leave_late", -6, 3), row("no_show", -10, 20, 180),
      row("complaint_dismissed", -2, 2), row("complaint_malicious", -15, 2), row("leave_refund", 6, 2),
      row("attend", 2, 200), // 已過期
    ];
    const b = trustBreakdown(rows, NOW);
    // 加分在前（出席 2 次分值合計大於成局 1 次）；扣分在後（放鴿子扣得多的在前）
    expect(b.map((x) => x.kind)).toEqual(["attend", "hosted_completed", "no_show", "leave_late"]);
    expect(b.find((x) => x.kind === "attend")).toMatchObject({ count: 2, positive: true });
    expect(b.some((x) => ["complaint_dismissed", "complaint_malicious", "leave_refund"].includes(x.kind))).toBe(false);
    expect(b.find((x) => x.kind === "no_show")?.positive).toBe(false);
  });
  it("reversal rows cancel the original event", () => {
    const rows = [row("no_show", -10, 5, 180), row("no_show:reversed", 10, 4, 180), row("attend", 2, 1)];
    const b = trustBreakdown(rows, NOW);
    expect(b.map((x) => x.kind)).toEqual(["attend"]);
    expect(upheld180d(rows, NOW)).toBe(0);
  });
  it("ignores garbage rows", () => {
    expect(trustBreakdown([{ kind: 5, delta: "x", created_at: null, expires_at: null }], NOW)).toEqual([]);
  });
});

describe("includeHidden（本人視角）", () => {
  it("shows filer-side and refund kinds only to the owner", () => {
    const rows = [row("complaint_dismissed", -2, 2), row("leave_refund", 6, 2), row("attend", 2, 1)];
    expect(trustBreakdown(rows, NOW).map((x) => x.kind)).toEqual(["attend"]);
    expect(trustBreakdown(rows, NOW, true).map((x) => x.kind).sort()).toEqual(["attend", "complaint_dismissed", "leave_refund"]);
    expect(buildPublicTrustDetail(rows, NOW, true).breakdown).toHaveLength(3);
  });
});

describe("trend / monthly / upheld", () => {
  it("trend has 8 weekly points ending at the current score and reflects when events happened", () => {
    const rows = [row("leave_late", -6, 3), row("attend", 2, 40, 180), row("attend", 2, 30, 180), row("attend", 2, 20, 180)];
    const t = trustTrend(rows, NOW);
    expect(t).toHaveLength(8);
    expect(t[7].at).toBe(iso(NOW));
    // 第一點（49 天前）還沒有任何事件 → 基礎分
    expect(t[0].score).toBe(70);
    // 3 天前的違約不影響更早的點
    expect(t[6].score).toBeGreaterThanOrEqual(t[7].score);
  });
  it("monthly attendance fills zero months, HK time, last 6 months oldest→newest", () => {
    const rows = [row("attend", 2, 2), row("attend", 2, 3), row("hosted_completed", 3, 40, 180)];
    const m = monthlyAttend(rows, NOW);
    expect(m).toHaveLength(6);
    expect(m[5]).toEqual({ month: "2026-10", count: 2 });
    expect(m[4]).toEqual({ month: "2026-09", count: 1 });
    expect(m[0].count).toBe(0);
  });
  it("upheld count only within 180 days", () => {
    expect(upheld180d([row("no_show", -10, 100, 180), row("harassment_upheld", -10, 200, 365), row("complaint_upheld", -4, 3)], NOW)).toBe(2);
  });
  it("buildPublicTrustDetail returns tier lines from config", () => {
    const d = buildPublicTrustDetail([], NOW);
    expect(d.tier_lines).toEqual({ trusted: 80, normal: 50, watch: 30, newbie_completed: 3 });
    expect(d.trend).toHaveLength(8);
  });
});
