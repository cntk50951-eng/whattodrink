import Link from "next/link";
import { notFound } from "next/navigation";

import { adminRateLimited, auditOrThrow, auditViewOnce, checkSameOrigin } from "@/lib/ops";
import { requireAdminPage } from "@/lib/opsPage";
import {
  applyReportDecision,
  findMissingReportNotifications,
  reopenReport,
  resendMissingReportNotifications,
  type ReportDecision,
  type ReportTargetType,
} from "@/lib/api/reportStp";
import type { SnapshotLine } from "@/lib/userReports";

export const metadata = { robots: { index: false, follow: false } };

const STATES = ["reviewed", "actioned", "dismissed"] as const;
const WHO_LABEL: Record<string, string> = { reported: "被舉報人", reporter: "舉報人", other: "其他人" };

/**
 * 用戶舉報詳情＋標記（白名單＋TOTP，非管理員 404）。
 * 證據快照是舉報當下的訊息／帖子文字（之後被刪也在）；moderator 可標記 reviewed／actioned／dismissed；
 * 只讀 viewer 只能看。寫操作先寫審計（失敗即中止）。
 * 本頁只記處理結果；帳號層面的處置（停權等）要走產品決定的政策，暫不在此頁提供。
 */
export default async function UserReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, role, svc } = await requireAdminPage({}, `/innerharbour/user-reports/${id}`);
  const { data: rRaw } = await svc.from("cheers_reports").select("*").eq("id", id).maybeSingle();
  const r = rRaw as Record<string, unknown> | null;
  if (r === null) notFound();
  await auditViewOnce(svc, { admin_id: userId, action: "view_user_report", target: id });

  // 同一個被舉報人被多少個不同的人舉報過（惡意用戶往往不止一條）
  const { count: others } = await svc
    .from("cheers_reports")
    .select("id", { count: "exact", head: true })
    .eq("target_user_id", String(r.target_user_id))
    .neq("id", id);

  async function mark(formData: FormData): Promise<void> {
    "use server";
    const g = await requireAdminPage({ write: true, stepUp: true }, `/innerharbour/user-reports/${id}`);
    if (!(await checkSameOrigin())) throw new Error("跨站請求被拒");
    const state = String(formData.get("state") ?? "");
    if (!(STATES as readonly string[]).includes(state)) throw new Error("狀態非法");
    if (await adminRateLimited(g.svc, g.userId, ["user_report_mark"], 30, 600_000)) {
      throw new Error("操作過於頻繁，請稍後再試");
    }
    await auditOrThrow(g.svc, { admin_id: g.userId, action: `user_report_${state}`, target: id });
    const { data: updated, error } = await g.svc
      .from("cheers_reports")
      .update({ status: state, decided_by: g.userId, decided_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["pending", "reviewed"])
      .select("id,target_type,target_ref,target_user_id,reporter_id,reason_code")
      .maybeSingle();
    if (error !== null || updated === null) throw new Error("標記失敗（可能已被處理）");
    if (state === "actioned" || state === "dismissed") {
      const row = updated as {
        target_type?: unknown;
        target_ref?: unknown;
        target_user_id?: unknown;
        reporter_id?: unknown;
        reason_code?: unknown;
      };
      const tt: ReportTargetType =
        row.target_type === "post" || row.target_type === "message" ? row.target_type : "user";
      const targetRef = typeof row.target_ref === "string" ? row.target_ref : null;
      let placeName: string | null = null;
      if (tt === "post" && targetRef !== null) {
        const { data: postRow } = await g.svc.from("checkins").select("place_name").eq("id", targetRef).maybeSingle();
        const pn = (postRow as { place_name?: unknown } | null)?.place_name;
        if (typeof pn === "string" && pn.trim() !== "") placeName = pn.trim();
      }
      if (typeof row.target_user_id === "string" && typeof row.reporter_id === "string") {
        const applied = await applyReportDecision(g.svc, {
          reportId: id,
          targetType: tt,
          targetRef,
          targetUserId: row.target_user_id,
          reporterId: row.reporter_id,
          reasonCode: typeof row.reason_code === "string" ? row.reason_code : null,
          placeName,
          decision: state,
          note: state === "actioned" ? "經管理員審核核實違規，已處理" : "經管理員審核暫未發現違規",
        });
        if (!applied.ok) {
          // 下架或扣分沒成功：退回 reviewed（頁面仍接受再按一次，處分冪等），不讓案件停在「已處理」卻沒執行
          const reopened = await reopenReport(g.svc, id, "actioned", "reviewed");
          throw new Error(
            reopened
              ? `處分未完成（${applied.failed.join("、")}），案件已退回「審核中」，請重新按一次`
              : `處分未完成（${applied.failed.join("、")}），且案件狀態無法退回，請到資料庫核對 report=${id} 後再處理`,
          );
        }
        // 處分已落地但結果通知沒寫成：不回退（下架／扣分是真的），明確報給管理員，日誌有 [needs-repair] 可對賬補發
        if (applied.notifyFailed.length > 0) {
          throw new Error(`處分已完成，但結果通知寫入失敗（${applied.notifyFailed.join("、")}），請記下案件 ${id} 並通知技術補發`);
        }
      }
    }
  }

  const decisionStatus: ReportDecision | null =
    r.status === "actioned" || r.status === "dismissed" ? r.status : null;
  const targetType: ReportTargetType =
    r.target_type === "post" || r.target_type === "message" ? r.target_type : "user";
  const missingNotify = decisionStatus !== null
    ? await findMissingReportNotifications(svc, { reportId: id, targetType, decision: decisionStatus })
    : { missingReported: false, missingReporter: false };

  async function resendNotifications(): Promise<void> {
    "use server";
    const g = await requireAdminPage({ write: true, stepUp: true }, `/innerharbour/user-reports/${id}`);
    if (!(await checkSameOrigin())) throw new Error("跨站請求被拒");
    await auditOrThrow(g.svc, { admin_id: g.userId, action: "user_report_resend_notify", target: id });
    const { data: rowRaw } = await g.svc
      .from("cheers_reports")
      .select("status,target_type,target_ref,target_user_id,reporter_id,reason_code")
      .eq("id", id)
      .maybeSingle();
    const row = rowRaw as {
      status?: unknown;
      target_type?: unknown;
      target_ref?: unknown;
      target_user_id?: unknown;
      reporter_id?: unknown;
      reason_code?: unknown;
    } | null;
    if (row === null || (row.status !== "actioned" && row.status !== "dismissed")) {
      throw new Error("僅已處理或駁回的案件可補發通知");
    }
    if (typeof row.target_user_id !== "string" || typeof row.reporter_id !== "string") {
      throw new Error("案件缺少收件人資料");
    }
    const tt: ReportTargetType =
      row.target_type === "post" || row.target_type === "message" ? row.target_type : "user";
    const targetRef = typeof row.target_ref === "string" ? row.target_ref : null;
    let placeName: string | null = null;
    if (tt === "post" && targetRef !== null) {
      const { data: postRow } = await g.svc.from("checkins").select("place_name").eq("id", targetRef).maybeSingle();
      const pn = (postRow as { place_name?: unknown } | null)?.place_name;
      if (typeof pn === "string" && pn.trim() !== "") placeName = pn.trim();
    }
    const res = await resendMissingReportNotifications(g.svc, {
      reportId: id,
      targetType: tt,
      targetRef,
      targetUserId: row.target_user_id,
      reporterId: row.reporter_id,
      reasonCode: typeof row.reason_code === "string" ? row.reason_code : null,
      placeName,
      decision: row.status,
      note: row.status === "actioned" ? "經管理員審核核實違規，已處理" : "經管理員審核暫未發現違規",
    });
    if (res.queryError) {
      throw new Error("無法查詢既有通知紀錄，請稍後重試");
    }
    if (res.failed.length > 0) {
      throw new Error(`補發通知失敗（${res.failed.join("、")}），請稍後再試`);
    }
  }

  const snapshot = Array.isArray(r.snapshot) ? (r.snapshot as SnapshotLine[]) : [];
  return (
    <main style={{ padding: 24 }}>
      <p>
        <Link href="/innerharbour/user-reports">← 隊列</Link>
      </p>
      <h1>
        {String(r.target_type)} · {typeof r.reason_code === "string" ? r.reason_code : "未填原因"} · {String(r.status)}
      </h1>
      <p>
        舉報人：{String(r.reporter_id)} ｜ 被舉報：{String(r.target_user_id)}
        {typeof r.target_ref === "string" ? ` ｜ 目標：${r.target_ref}` : ""}
      </p>
      <p>此被舉報人另有 {others ?? 0} 條其他舉報。</p>
      <p>說明：{typeof r.reason === "string" && r.reason !== "" ? r.reason : "（無）"}</p>
      <h2>證據快照</h2>
      {snapshot.length === 0 ? (
        <p>（無快照：用戶級舉報，或證據已過期清理）</p>
      ) : (
        <ul>
          {snapshot.map((m, i) => (
            <li key={i} style={m.who === "reported" ? { fontWeight: 700 } : undefined}>
              {WHO_LABEL[m.who] ?? m.who}：{m.text} · {m.at ?? ""}
            </li>
          ))}
        </ul>
      )}
      {role === "moderator" ? (
        <>
          <form action={mark}>
            <label>
              標記：
              <select name="state" defaultValue="reviewed">
                <option value="reviewed">已看</option>
                <option value="actioned">已處理</option>
                <option value="dismissed">駁回</option>
              </select>
            </label>{" "}
            <button type="submit">提交</button>
          </form>
          {missingNotify.queryError ? (
            <form action={resendNotifications} style={{ marginTop: 16 }}>
              <p style={{ color: "#dc2626" }}>無法確認結果通知是否齊全（資料庫讀取失敗），請重試對賬並補發缺漏通知。</p>
              <button type="submit">重試對賬並補發通知</button>
            </form>
          ) : (missingNotify.missingReported || missingNotify.missingReporter) ? (
            <form action={resendNotifications} style={{ marginTop: 16 }}>
              <p style={{ color: "#b45309" }}>
                偵測到缺漏結果通知：
                {[
                  missingNotify.missingReported ? "被舉報人" : null,
                  missingNotify.missingReporter ? "舉報人" : null,
                ].filter(Boolean).join("、")}
              </p>
              <button type="submit">補發缺漏通知</button>
            </form>
          ) : null}
        </>
      ) : (
        <p>只讀權限：標記請找 moderator。</p>
      )}
    </main>
  );
}
