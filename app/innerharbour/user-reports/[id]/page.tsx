import Link from "next/link";
import { notFound } from "next/navigation";

import { adminRateLimited, auditOrThrow, auditViewOnce, checkSameOrigin } from "@/lib/ops";
import { requireAdminPage } from "@/lib/opsPage";
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
    const { error } = await g.svc
      .from("cheers_reports")
      .update({ status: state, decided_by: g.userId, decided_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["pending", "reviewed"]);
    if (error !== null) throw new Error("標記失敗（可能已被處理）");
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
      ) : (
        <p>只讀權限：標記請找 moderator。</p>
      )}
    </main>
  );
}
