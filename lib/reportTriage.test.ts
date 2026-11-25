import { describe, expect, it } from "vitest";

import { REPORT_AUTO_ACTION_MIN, REPORT_AUTO_DISMISS_MAX, reportedTextFromSnapshot, routeReport } from "./reportTriage";

const openai = (flagged: boolean, score: number) =>
  flagged
    ? ({ flagged: true as const, categories: ["harassment"], via: "openai" as const, score })
    : ({ flagged: false as const, via: "openai" as const, score });

describe("routeReport 置信度分流（DEF-20261125-020〜024）", () => {
  it("分數 ≥ 0.85 → 自動處分", () => {
    const r = routeReport({ reasonCode: "harassment", verdict: openai(true, REPORT_AUTO_ACTION_MIN) });
    expect(r).toMatchObject({ decision: "auto_actioned", reason: "high_confidence", score: 0.85, categories: ["harassment"] });
  });
  it("未標記且分數 ≤ 0.10 → 自動結案", () => {
    expect(routeReport({ reasonCode: "inappropriate", verdict: openai(false, REPORT_AUTO_DISMISS_MAX) }).decision).toBe("auto_dismissed");
  });
  it("中間分數 → 人工（low_confidence）", () => {
    expect(routeReport({ reasonCode: null, verdict: openai(false, 0.4) })).toMatchObject({ decision: "human", reason: "low_confidence", score: 0.4 });
    // 被標記但分數不到門檻：也不自動處分
    expect(routeReport({ reasonCode: null, verdict: openai(true, 0.6) }).decision).toBe("human");
  });
  it("AI 判斷不了的理由（垃圾訊息／未成年／其他）一律人工，即使分數很低", () => {
    for (const code of ["spam", "underage", "other"]) {
      expect(routeReport({ reasonCode: code, verdict: openai(false, 0.01) })).toMatchObject({ decision: "human", reason: "reason_needs_human" });
    }
  });
  it("AI 不可用／沒內容／Minimax 兜底（無分數）→ 人工", () => {
    expect(routeReport({ reasonCode: null, verdict: null }).reason).toBe("ai_unavailable");
    expect(routeReport({ reasonCode: null, verdict: { flagged: false, skipped: true, reason: "no-input" } }).reason).toBe("no_content");
    expect(routeReport({ reasonCode: null, verdict: { flagged: false, skipped: true, reason: "all-failed" } }).reason).toBe("ai_unavailable");
    expect(routeReport({ reasonCode: null, verdict: { flagged: true, categories: ["minimax:porn"], via: "minimax" } })).toMatchObject({ decision: "human", reason: "ai_unavailable" });
  });
});

describe("reportedTextFromSnapshot", () => {
  it("只取被舉報人說的話", () => {
    const snap = [
      { who: "reporter", kind: "text", text: "你好", at: null },
      { who: "reported", kind: "text", text: "  罵人的話 ", at: null },
      { who: "other", kind: "text", text: "旁人", at: null },
      { who: "reported", kind: "image", text: "", at: null },
    ];
    expect(reportedTextFromSnapshot(snap)).toBe("罵人的話");
    expect(reportedTextFromSnapshot(null)).toBe("");
  });
});
