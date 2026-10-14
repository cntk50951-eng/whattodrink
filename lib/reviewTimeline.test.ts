import { describe, expect, it } from "vitest";
import { buildCaseTimeline, fmtHK, type TimelineInput } from "./reviewTimeline";

const base = (over: Partial<TimelineInput> = {}): TimelineInput => ({
  complaint: { category: "safety", detail: "騷擾", created_at: "2026-10-14T12:21:00Z", decided_at: "2026-10-14T13:38:00Z", decision: "uphold" },
  filerId: "f", targetId: "t",
  party: { place: "Sake", startAt: "2026-10-14T11:00:00Z", expiresAt: "2026-10-14T14:00:00Z", hostId: "h" },
  partyEvents: [{ userId: "t", name: "HK Trash", kindLabel: "加入酒局", at: "2026-10-14T09:00:00Z" }],
  attendance: [], effects: [], audit: [], evidenceCount: 0, ai: null, ...over,
});

describe("buildCaseTimeline", () => {
  it("sorts oldest first", () => {
    const t = buildCaseTimeline(base());
    const ats = t.map((x) => Date.parse(x.at));
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    expect(t[0].title).toContain("加入酒局");
  });
  it("tags filer / target roles", () => {
    const t = buildCaseTimeline(base());
    expect(t.find((x) => x.title.includes("加入"))?.tag).toBe("被投訴人");
    expect(t.find((x) => x.title.startsWith("提出投訴"))?.tag).toBe("投訴人");
  });
  it("falls back to decided_at when no decide audit; skips when audit has it", () => {
    expect(buildCaseTimeline(base()).some((x) => x.title.startsWith("判定："))).toBe(true);
    const withAudit = base({ audit: [{ at: "2026-10-14T13:38:00Z", admin: "A", label: "判定已執行", summary: "" }] });
    expect(buildCaseTimeline(withAudit).some((x) => x.title.startsWith("判定："))).toBe(false);
  });
  it("keeps response and appeal in order and drops bad dates", () => {
    const t = buildCaseTimeline(base({
      complaint: { category: "other", created_at: "2026-10-14T10:00:00Z", responded_at: "2026-10-14T11:00:00Z", response_text: "不是我", appealed_at: "garbage", decided_at: null },
    }));
    expect(t.map((x) => x.title).filter((s) => s.includes("申辯") || s.includes("申訴"))).toEqual(["提交申辯"]);
  });
  it("formats Hong Kong time", () => {
    expect(fmtHK("2026-10-14T16:30:00Z")).toContain("00:30");
    expect(fmtHK(null)).toBe("—");
  });
});
