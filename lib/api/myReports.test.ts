import { describe, expect, it } from "vitest";

import { myReportDecidedBy, myReportStage, myReportStatus, parseMyReportsLimit, toMyReportDetail, toMyReportItem } from "./myReports";

const row = {
  id: "r1", target_type: "post", target_ref: "c1", target_user_id: "u2", reason_code: "harassment", reason: "罵人",
  status: "pending", snapshot: [{ who: "reported", kind: "photo", text: "中環 · 罵人", at: "2026-11-25T10:00:00Z" }],
  created_at: "2026-11-25T10:01:00Z", decided_at: null, decided_by: null, ai_decision: "human", ai_checked_at: "2026-11-25T10:01:05Z",
  decision_note: null,
};
const target = { nickname: "Chris", avatar_url: null, place_name: "中環" };

describe("我的舉報（舉報人視角）", () => {
  it("狀態：pending／reviewed＝處理中；AI 轉人工＝人工審核中", () => {
    expect(myReportStatus("pending")).toBe("reviewing");
    expect(myReportStatus("reviewed")).toBe("reviewing");
    expect(myReportStage({ status: "pending", ai_decision: undefined })).toBe("submitted");
    expect(myReportStage({ status: "pending", ai_decision: "human" })).toBe("human_review");
    expect(myReportStage({ status: "reviewed", ai_decision: undefined })).toBe("human_review");
    expect(myReportStage({ status: "dismissed", ai_decision: "auto_dismissed" })).toBe("closed");
  });
  it("誰結案：AI 自動＝system；有審核人＝staff；未結案＝null", () => {
    expect(myReportDecidedBy({ status: "dismissed", ai_decision: "auto_dismissed", decided_by: null })).toBe("system");
    expect(myReportDecidedBy({ status: "actioned", ai_decision: "auto_dismissed", decided_by: "admin" })).toBe("staff");
    expect(myReportDecidedBy({ status: "pending", ai_decision: "human", decided_by: null })).toBeNull();
  });
  it("列表項不含 AI 分數與審核人身份", () => {
    const item = toMyReportItem({ ...row, ai_score: 0.4 } as never, target);
    expect(item).toMatchObject({ status: "reviewing", stage: "human_review", target_name: "Chris", place_name: "中環", decided_at: null });
    expect(Object.keys(item)).not.toContain("ai_score");
    expect(JSON.stringify(item)).not.toContain("0.4");
  });
  it("詳情帶證據與時間線", () => {
    const d = toMyReportDetail({ ...row, status: "actioned", decided_at: "2026-11-25T11:00:00Z", decided_by: "admin", decision_note: "已處理" }, target);
    expect(d.evidence).toEqual([{ who: "reported", kind: "photo", text: "中環 · 罵人", at: "2026-11-25T10:00:00Z" }]);
    expect(d.timeline).toEqual([
      { step: "submitted", at: "2026-11-25T10:01:00Z" },
      { step: "human_review", at: "2026-11-25T10:01:05Z" },
      { step: "actioned", at: "2026-11-25T11:00:00Z" },
    ]);
    expect(d.decision_note).toBe("已處理");
  });
  it("limit 夾在 1–50，預設 20", () => {
    expect(parseMyReportsLimit(null)).toBe(20);
    expect(parseMyReportsLimit("0")).toBe(20);
    expect(parseMyReportsLimit("999")).toBe(50);
  });
});
