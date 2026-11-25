import { describe, expect, it } from "vitest";

import { reportTrustDelta, reportTrustExpireDays, reportTrustKind } from "./reportStp";

describe("reportStp trust scoring helpers", () => {
  it("deducts -6 for upheld post reports with 90d expiry", () => {
    expect(reportTrustDelta("post", "inappropriate")).toBe(-6);
    expect(reportTrustDelta("post", "other")).toBe(-6);
    expect(reportTrustKind("post")).toBe("post_report_upheld");
    expect(reportTrustExpireDays("post")).toBe(90);
  });

  it("deducts -10 for severe user/message reports and -6 for other", () => {
    expect(reportTrustDelta("user", "harassment")).toBe(-10);
    expect(reportTrustDelta("user", "underage")).toBe(-10);
    expect(reportTrustDelta("message", "spam")).toBe(-10);
    expect(reportTrustDelta("user", "other")).toBe(-6);
    expect(reportTrustDelta("user", null)).toBe(-6);
    expect(reportTrustKind("user")).toBe("user_report_upheld");
    expect(reportTrustExpireDays("user")).toBe(180);
  });
});

import { applyReportDecision, reopenReport } from "./reportStp";

type Overrides = { hideError?: boolean; trustError?: boolean; notifyError?: boolean };
/** 假 supabase：任何鏈式呼叫都回自己，await 時按 (table, op) 給結果；記錄寫入操作。回傳 `{error}` 而不是拋例外。 */
function fakeSvc(o: Overrides = {}) {
  const log: string[] = [];
  const svc = {
    from(table: string) {
      let op = "select";
      const result = () => {
        if (table === "checkins" && op === "update" && o.hideError) return { data: null, error: { code: "XX000" } };
        if (table === "trust_events" && op === "insert" && o.trustError) return { data: null, error: { code: "XX000" } };
        if (table === "notifications" && op === "insert" && o.notifyError) return { data: null, error: { code: "23505" } };
        return { data: [], error: null };
      };
      const q: unknown = new Proxy({}, {
        get(_t, prop) {
          if (prop === "then") return (res: (v: unknown) => unknown) => res(result());
          if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") {
            return () => {
              op = String(prop);
              log.push(`${table}.${op}`);
              return q;
            };
          }
          return () => q;
        },
      });
      return q;
    },
  };
  return { svc: svc as never, log };
}

const base = {
  reportId: "r1", targetType: "post" as const, targetRef: "c1", targetUserId: "u2", reporterId: "u1",
  reasonCode: "inappropriate", decision: "actioned" as const,
};

describe("applyReportDecision 先確認業務結果再通知（第七輪 §3.2）", () => {
  it("下架回 {error} → ok:false，且不發任何通知", async () => {
    const { svc, log } = fakeSvc({ hideError: true });
    const r = await applyReportDecision(svc, base);
    expect(r.ok).toBe(false);
    expect(r.failed).toContain("hide");
    expect(log.filter((l) => l.startsWith("notifications."))).toEqual([]);
  });

  it("扣分 db-error → ok:false，且不發通知", async () => {
    const { svc, log } = fakeSvc({ trustError: true });
    const r = await applyReportDecision(svc, base);
    expect(r.ok).toBe(false);
    expect(r.failed).toContain("trust");
    expect(log.filter((l) => l.startsWith("notifications."))).toEqual([]);
  });

  it("駁回不涉及下架／扣分，照常通知舉報人", async () => {
    const { svc, log } = fakeSvc({ hideError: true, trustError: true });
    const r = await applyReportDecision(svc, { ...base, decision: "dismissed" });
    expect(r.ok).toBe(true);
    expect(log).toContain("notifications.insert");
    expect(log).not.toContain("checkins.update");
  });

  it("reopenReport 只退回仍是我們寫入的終態那一行", async () => {
    const { svc, log } = fakeSvc();
    // 假 svc 的 select 結果是空陣列 → 沒有行被退回（例如已被別人改過）→ false
    expect(await reopenReport(svc, "r1", "actioned", "pending")).toBe(false);
    expect(log).toContain("cheers_reports.update");
  });

  it("處分成功但兩筆結果通知回 {error} → ok:true 但 notifyFailed 列出雙方（第八輪 R8-03），不假裝全成功", async () => {
    const { svc } = fakeSvc({ notifyError: true });
    const r = await applyReportDecision(svc, { ...base, targetType: "user", targetRef: null });
    expect(r.ok).toBe(true);
    expect(r.notifyFailed.sort()).toEqual(["reported", "reporter"]);
  });

  it("通知正常 → notifyFailed 為空", async () => {
    const { svc } = fakeSvc();
    const r = await applyReportDecision(svc, { ...base, decision: "dismissed" });
    expect(r.notifyFailed).toEqual([]);
  });
});
