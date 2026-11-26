import { describe, expect, it } from "vitest";

import { reportTrustDelta, reportTrustExpireDays, reportTrustKind } from "./reportStp";

describe("reportStp trust scoring helpers", () => {
  it("酒局（0093）：虛假／違法危險 -10，其餘 -6，180 天", () => {
    expect(reportTrustDelta("party", "fake")).toBe(-10);
    expect(reportTrustDelta("party", "dangerous")).toBe(-10);
    expect(reportTrustDelta("party", "harassment")).toBe(-6);
    expect(reportTrustKind("party")).toBe("party_report_upheld");
    expect(reportTrustExpireDays("party")).toBe(180);
  });

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

import { applyReportDecision, findMissingReportNotifications, reopenReport, resendMissingReportNotifications } from "./reportStp";

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
        if (table === "notifications" && op === "insert" && o.notifyError) return { data: null, error: { code: "XX000" } };
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

  it("resendMissingReportNotifications 只補發缺漏一方，不重複寫入已存在的通知（第九輪 §3.4）", async () => {
    const insertedKinds: string[] = [];
    const svc = {
      from() {
        let op = "select";
        const q: unknown = new Proxy({}, {
          get(_t, prop) {
            if (prop === "then") {
              return (res: (v: unknown) => unknown) => {
                if (op === "select") return res({ data: [{ kind: "post_actioned" }], error: null });
                return res({ data: [], error: null });
              };
            }
            if (prop === "insert") {
              return (payload: { kind?: string }) => {
                op = "insert";
                if (payload?.kind) insertedKinds.push(payload.kind);
                return q;
              };
            }
            return () => q;
          },
        });
        return q;
      },
    };
    const missing = await findMissingReportNotifications(svc as never, {
      reportId: "r1", targetType: "post", decision: "actioned",
    });
    expect(missing).toEqual({ missingReported: false, missingReporter: true });
    const resent = await resendMissingReportNotifications(svc as never, base);
    expect(resent).toEqual({ sent: ["reporter"], failed: [] });
    expect(insertedKinds).toEqual(["report_resolved"]);
  });

  it("findMissingReportNotifications 查詢失敗回 queryError:true，不靜默當無缺漏（第十輪 §3.4）", async () => {
    const errSvc = {
      from() {
        const q: unknown = new Proxy({}, {
          get(_t, prop) {
            if (prop === "then") return (res: (v: unknown) => unknown) => res({ data: null, error: { code: "XX000" } });
            return () => q;
          },
        });
        return q;
      },
    };
    const missing = await findMissingReportNotifications(errSvc as never, {
      reportId: "r1", targetType: "post", decision: "actioned",
    });
    expect(missing.queryError).toBe(true);
    const resent = await resendMissingReportNotifications(errSvc as never, base);
    expect(resent.queryError).toBe(true);
  });

  it("補發通知遇 0087 唯一索引 23505 視為已送達成功（第十輪 §3.4）", async () => {
    const dupSvc = {
      from() {
        let op = "select";
        const q: unknown = new Proxy({}, {
          get(_t, prop) {
            if (prop === "then") {
              return (res: (v: unknown) => unknown) =>
                op === "select" ? res({ data: [], error: null }) : res({ data: null, error: { code: "23505" } });
            }
            if (prop === "insert") return () => { op = "insert"; return q; };
            return () => q;
          },
        });
        return q;
      },
    };
    const resent = await resendMissingReportNotifications(dupSvc as never, base);
    expect(resent).toEqual({ sent: ["reported", "reporter"], failed: [] });
  });

  it("通知正常 → notifyFailed 為空", async () => {
    const { svc } = fakeSvc();
    const r = await applyReportDecision(svc, { ...base, decision: "dismissed" });
    expect(r.notifyFailed).toEqual([]);
  });
});
