import { describe, expect, it } from "vitest";

import { allowSelfCaseEnabled, auditActionLabel, auditSummary, decisionLabel, effectLabel, genderLabel, isSelfCase, pairHistory, selfCaseBlock, tallyComplaints } from "./reviewContext";

const rows = [
  { id: "c0", filer_id: "A", target_id: "B", status: "escalated", category: "no_show", created_at: "2026-10-14T10:00:00Z" },
  { id: "c1", filer_id: "A", target_id: "B", status: "upheld", category: "mismatch", created_at: "2026-10-01T10:00:00Z" },
  { id: "c2", filer_id: "B", target_id: "A", status: "dismissed", category: "harassment", created_at: "2026-10-05T10:00:00Z" },
  { id: "c3", filer_id: "A", target_id: "C", status: "malicious", category: "other", created_at: "2026-09-20T10:00:00Z" },
  { id: "c4", filer_id: "D", target_id: "B", status: "upheld", category: "no_show", created_at: "2026-09-10T10:00:00Z" },
  { id: "c5", filer_id: "D", target_id: "E", status: "pending", category: "other", created_at: "2026-09-11T10:00:00Z" },
];

describe("tallyComplaints", () => {
  it("統計某人作為投訴人的結果，排除本案", () => {
    expect(tallyComplaints(rows, "filer_id", "A", "c0")).toEqual({ total: 2, upheld: 1, dismissed: 0, malicious: 1, pending: 0 });
  });
  it("統計作為被投訴人；未決（escalated／pending）歸 pending", () => {
    expect(tallyComplaints(rows, "target_id", "B", "c0")).toEqual({ total: 2, upheld: 2, dismissed: 0, malicious: 0, pending: 0 });
    expect(tallyComplaints(rows, "target_id", "B", "none").pending).toBe(1);
  });
  it("沒有記錄回全 0", () => {
    expect(tallyComplaints(rows, "filer_id", "Z", "c0").total).toBe(0);
  });
});

describe("pairHistory", () => {
  it("只列雙方之間的別案，區分同向／反向，新到舊，排除本案", () => {
    const h = pairHistory(rows, "A", "B", "c0");
    expect(h.map((x) => x.id)).toEqual(["c2", "c1"]);
    expect(h.find((x) => x.id === "c1")?.direction).toBe("same");
    expect(h.find((x) => x.id === "c2")?.direction).toBe("reverse");
  });
  it("無交集回空", () => {
    expect(pairHistory(rows, "D", "E", "c5")).toEqual([]);
  });
});

describe("genderLabel", () => {
  it("映射與兜底", () => {
    expect(genderLabel("male")).toBe("男");
    expect(genderLabel("female")).toBe("女");
    expect(genderLabel("secret")).toBe("保密");
    expect(genderLabel(null)).toBe("未填");
    expect(genderLabel("x")).toBe("未填");
  });
});

describe("利益衝突回避（四眼原則）", () => {
  const base = { adminId: "ADM", filerId: "A", targetId: "B", partyHostId: "H", adminInParty: false };
  it("默認：自己是投訴人／被投訴人／局主／局成員都不可審", () => {
    expect(selfCaseBlock({ ...base, allowSelf: false })).toBeNull();
    expect(selfCaseBlock({ ...base, filerId: "ADM", allowSelf: false })).toBe("self_case");
    expect(selfCaseBlock({ ...base, targetId: "ADM", allowSelf: false })).toBe("self_case");
    expect(selfCaseBlock({ ...base, partyHostId: "ADM", allowSelf: false })).toBe("same_party");
    expect(selfCaseBlock({ ...base, adminInParty: true, allowSelf: false })).toBe("same_party");
  });
  it("測試開關開啟：全部放行，但 isSelfCase 仍能識別（供審計標記）", () => {
    expect(selfCaseBlock({ ...base, filerId: "ADM", allowSelf: true })).toBeNull();
    expect(isSelfCase({ ...base, filerId: "ADM" })).toBe(true);
    expect(isSelfCase(base)).toBe(false);
  });
  it("開關只認明確的 true（默認關）", () => {
    expect(allowSelfCaseEnabled(undefined)).toBe(false);
    expect(allowSelfCaseEnabled("")).toBe(false);
    expect(allowSelfCaseEnabled("1")).toBe(false);
    expect(allowSelfCaseEnabled("true")).toBe(true);
  });
});

describe("判定記錄的人話", () => {
  it("決定與審計動作", () => {
    expect(decisionLabel("uphold")).toBe("成立");
    expect(decisionLabel("dismiss")).toBe("駁回");
    expect(decisionLabel("malicious")).toBe("惡意");
    expect(decisionLabel(null)).toBe("—");
    expect(auditActionLabel("decide_decided")).toBe("判定已執行");
    expect(auditActionLabel("decide_maintained")).toBe("申訴維持原判");
    expect(auditActionLabel("weird")).toBe("weird");
  });
  it("積分記錄：扣分／加分／沖銷", () => {
    expect(effectLabel({ kind: "no_show", delta: -10, reversed: false })).toBe("no_show -10");
    expect(effectLabel({ kind: "no_show:reversed", delta: 10, reversed: true })).toBe("沖銷：no_show +10");
  });
  it("審計摘要：決定／severity／自審標記／錯誤", () => {
    expect(auditSummary({ decision: "uphold", severity: 2, reason: "evidence_confirmed", note: "核對屬實" }))
      .toBe("決定：成立；severity 2；對外理由 evidence_confirmed；備註：核對屬實");
    expect(auditSummary({ decision: "dismiss", self_review: true })).toContain("自審");
    expect(auditSummary({ error: "busy" })).toBe("錯誤 busy");
    expect(auditSummary(null)).toBe("");
  });
});
