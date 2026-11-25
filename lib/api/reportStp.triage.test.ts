import { describe, expect, it, vi } from "vitest";

import { overrideAutoDismissal, reverseActionedReport, runReportStp } from "./reportStp";

type Write = { table: string; op: string; values: unknown; filters: string[] };
/** 假 supabase：記錄寫入（含值與 .is/.eq 條件）；cheers_reports 的 update 預設搶到一行。 */
function fakeSvc(o: { claimError?: string; noClaim?: boolean; resolvedRow?: boolean; prevVis?: string | null; actionedRow?: boolean } = {}) {
  const writes: Write[] = [];
  const svc = {
    from(table: string) {
      let op = "select";
      let values: unknown = null;
      const filters: string[] = [];
      const result = () => {
        if (table === "cheers_reports" && op === "update") {
          const isEmailClaim = (values as Record<string, unknown>)?.support_emailed_at !== undefined && filters.includes("is:support_emailed_at");
          if (isEmailClaim && o.claimError) return { data: null, error: { code: o.claimError } };
          if (o.noClaim) return { data: [], error: null };
          return { data: [{ id: "r1", hidden_prev_visibility: o.prevVis ?? null }], error: null };
        }
        if (table === "notifications" && op === "select" && (o.resolvedRow || o.actionedRow)) return { data: [{ id: "n1", payload: { report_id: "r1", decision: "actioned" } }], error: null };
        if (table === "notifications" && op === "insert" && (values as { kind?: string })?.kind === "report_resolved" && o.resolvedRow) return { data: null, error: { code: "23505" } };
        return { data: [], error: null };
      };
      const q: unknown = new Proxy({}, {
        get(_t, prop) {
          if (prop === "then") return (res: (v: unknown) => unknown) => res(result());
          if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
            return (v: unknown) => {
              op = String(prop);
              values = v;
              writes.push({ table, op, values: v, filters });
              return q;
            };
          }
          if (prop === "is" || prop === "eq") return (col: string) => { filters.push(`${String(prop)}:${col}`); return q; };
          return () => q;
        },
      });
      return q;
    },
  };
  return { svc: svc as never, writes };
}

const base = {
  reportId: "r1", targetType: "post" as const, targetRef: "c1", targetUserId: "u2", reporterId: "u1",
  reasonCode: "harassment", reasonText: null, placeName: "中環", targetName: "Chris", content: { text: "罵人" },
};
const openai = (flagged: boolean, score: number) => async () =>
  flagged ? { flagged: true as const, categories: ["harassment"], via: "openai" as const, score } : { flagged: false as const, via: "openai" as const, score };

describe("runReportStp 置信度分流", () => {
  it("高置信違規：自動處分（下架、寫 AI 欄位），不寄郵件", async () => {
    const { svc, writes } = fakeSvc();
    const sendEmail = vi.fn();
    const r = await runReportStp(svc, { ...base, moderate: openai(true, 0.97), sendEmail });
    expect(r).toEqual({ decision: "auto_actioned", emailed: false });
    expect(writes.some((w) => w.table === "checkins" && (w.values as { visibility?: string }).visibility === "private")).toBe(true);
    expect(writes.some((w) => w.table === "cheers_reports" && (w.values as { ai_decision?: string }).ai_decision === "auto_actioned")).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("高置信無違規：自動結案，通知舉報人，不下架不寄信", async () => {
    const { svc, writes } = fakeSvc();
    const sendEmail = vi.fn();
    const r = await runReportStp(svc, { ...base, moderate: openai(false, 0.02), sendEmail });
    expect(r.decision).toBe("auto_dismissed");
    expect(writes.some((w) => w.table === "checkins")).toBe(false);
    expect(writes.some((w) => w.table === "notifications" && (w.values as { kind?: string; payload?: { decision?: string } }).kind === "report_resolved"
      && (w.values as { payload: { decision: string } }).payload.decision === "dismissed")).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("置信度不足：人工＋通知帖子作者審核中＋寄一次郵件（先佔位）", async () => {
    const { svc, writes } = fakeSvc();
    const sendEmail = vi.fn(async () => ({ ok: true as const, id: "em_1" }));
    const r = await runReportStp(svc, { ...base, moderate: openai(false, 0.4), sendEmail });
    expect(r).toEqual({ decision: "human", emailed: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(writes.some((w) => w.table === "notifications" && (w.values as { kind?: string }).kind === "post_reported")).toBe(true);
    const claim = writes.find((w) => w.table === "cheers_reports" && typeof (w.values as { support_emailed_at?: unknown }).support_emailed_at === "string");
    expect(claim?.filters).toContain("is:support_emailed_at");
  });

  it("郵件寄失敗：把 support_emailed_at 清回 NULL 以便重寄", async () => {
    const { svc, writes } = fakeSvc();
    const sendEmail = vi.fn(async () => ({ ok: false as const, status: 403, error: "domain not verified" }));
    const r = await runReportStp(svc, { ...base, moderate: openai(false, 0.4), sendEmail });
    expect(r.emailed).toBe(false);
    expect(writes.some((w) => w.table === "cheers_reports" && (w.values as { support_emailed_at?: unknown }).support_emailed_at === null)).toBe(true);
  });

  it("另一方已佔位（並發）：不重寄", async () => {
    const { svc } = fakeSvc({ noClaim: true });
    const sendEmail = vi.fn();
    // noClaim 也讓自動處分搶不到 → 走人工；佔位也搶不到 → 不寄
    const r = await runReportStp(svc, { ...base, moderate: openai(false, 0.4), sendEmail });
    expect(r).toEqual({ decision: "human", emailed: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("AI 判斷不了的理由：不調 AI，直接人工（用戶舉報不通知作者）", async () => {
    const { svc, writes } = fakeSvc();
    const moderate = vi.fn();
    const sendEmail = vi.fn(async () => ({ ok: true as const, id: null }));
    const r = await runReportStp(svc, { ...base, targetType: "user", targetRef: null, reasonCode: "underage", moderate, sendEmail });
    expect(r.decision).toBe("human");
    expect(moderate).not.toHaveBeenCalled();
    expect(writes.some((w) => w.table === "notifications" && (w.values as { kind?: string }).kind === "post_reported")).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("0090 未遷移（42703）：不能去重但照寄", async () => {
    const { svc } = fakeSvc({ claimError: "42703" });
    const sendEmail = vi.fn(async () => ({ ok: true as const, id: null }));
    expect((await runReportStp(svc, { ...base, moderate: openai(false, 0.4), sendEmail })).emailed).toBe(true);
  });
});

describe("overrideAutoDismissal 推翻 AI 自動結案", () => {
  it("改判成立：處分並改寫舉報人原通知（置頂、標未讀）", async () => {
    const { svc, writes } = fakeSvc({ resolvedRow: true });
    const r = await overrideAutoDismissal(svc, {
      reportId: "r1", adminId: "a1", targetType: "post", targetRef: "c1", targetUserId: "u2", reporterId: "u1", reasonCode: "harassment", note: "複核確認違規",
    });
    expect(r.ok).toBe(true);
    expect(writes.some((w) => w.table === "checkins")).toBe(true);
    const rewrite = writes.find((w) => w.table === "notifications" && w.op === "update");
    expect(rewrite?.values).toMatchObject({ read_at: null, payload: { decision: "actioned", note: "複核確認違規", updated: true } });
  });
  it("已不是不成立狀態：不處分", async () => {
    const { svc, writes } = fakeSvc({ noClaim: true });
    const r = await overrideAutoDismissal(svc, {
      reportId: "r1", adminId: "a1", targetType: "post", targetRef: "c1", targetUserId: "u2", reporterId: "u1", reasonCode: null, note: "x",
    });
    expect(r).toMatchObject({ ok: false, failed: ["not_dismissed"] });
    expect(writes.some((w) => w.table === "checkins")).toBe(false);
  });
});

describe("reverseActionedReport 改判不成立（還原處分）", () => {
  const args = { reportId: "r1", adminId: "a1", targetType: "post" as const, targetRef: "c1", targetUserId: "u2", reporterId: "u1", reasonCode: "harassment", note: "複核未發現違規" };

  it("還原原可見性、退回誠信分（正分、冪等 ref）、改寫雙方通知", async () => {
    const { svc, writes } = fakeSvc({ prevVis: "public", actionedRow: true });
    const r = await reverseActionedReport(svc, args);
    expect(r).toMatchObject({ ok: true, warnings: [] });
    expect(writes.some((w) => w.table === "checkins" && (w.values as { visibility?: string }).visibility === "public")).toBe(true);
    const trust = writes.find((w) => w.table === "trust_events" && w.op === "insert");
    expect(trust?.values).toMatchObject({ delta: 6, ref_id: "report:r1:revert", kind: "post_report_reverted" });
    const rewrites = writes.filter((w) => w.table === "notifications" && w.op === "update").map((w) => (w.values as { payload: Record<string, unknown> }).payload);
    expect(rewrites).toContainEqual(expect.objectContaining({ decision: "dismissed", updated: true }));
    expect(rewrites).toContainEqual(expect.objectContaining({ reverted: true }));
  });

  it("0091 前下架（沒記原可見性）：不亂改帖子，回 restore_unknown", async () => {
    const { svc, writes } = fakeSvc({ prevVis: null });
    const r = await reverseActionedReport(svc, args);
    expect(r.ok).toBe(true);
    expect(r.warnings).toContain("restore_unknown");
    expect(writes.some((w) => w.table === "checkins")).toBe(false);
  });

  it("已不是成立狀態：什麼都不做", async () => {
    const { svc, writes } = fakeSvc({ noClaim: true });
    expect(await reverseActionedReport(svc, args)).toMatchObject({ ok: false, failed: ["not_actioned"] });
    expect(writes.some((w) => w.table === "trust_events" || w.table === "checkins")).toBe(false);
  });
});

