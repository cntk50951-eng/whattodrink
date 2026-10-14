import Link from "next/link";
import { after } from "next/server";

import { sweepOverdueResponses } from "@/lib/complaints";
import { requireAdminPage } from "@/lib/opsPage";

export const metadata = { robots: { index: false, follow: false } };

/* eslint-disable react-hooks/purity -- Server Component 整页门禁＋列表必须在 render 读库；无客户端交互，无其他写法。 */

/**
 * 內部審核隊列（UR E.31 C2；路徑隱蔽＋白名單＋TOTP，非管理員 404）。
 * status escalated／triaged，safety 優先；顯示等待時長與 flags；頂部顯示未簽收的 safety 告警。
 */
export default async function ReviewQueuePage() {
  const { svc } = await requireAdminPage({}, "/innerharbour/review");
  // 沒有定時任務時，申辯逾期轉人工由隊列載入順帶掃（不阻塞渲染）。
  after(() => {
    void sweepOverdueResponses(svc);
  });
  const [{ data: rows }, { data: alerts }] = await Promise.all([
    svc
      .from("complaints")
      .select("id,party_id,category,status,flags,appeal_status,created_at,ai_json")
      .in("status", ["escalated", "triaged"])
      .order("created_at", { ascending: true })
      .limit(200),
    svc
      .from("safety_alerts")
      .select("id,complaint_id,created_at")
      .is("handled_at", null)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  const list = ((rows ?? []) as unknown[]) as Record<string, unknown>[];
  const openAlerts = ((alerts ?? []) as unknown[]) as { id?: unknown; complaint_id?: unknown; created_at?: unknown }[];
  const waitH = (iso: unknown): string => {
    const t = typeof iso === "string" ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t)) return "-";
    const h = (Date.now() - t) / 3600_000;
    return h < 1 ? `${Math.round(h * 60)}分` : `${Math.round(h * 10) / 10}h`;
  };
  const overdue = (iso: unknown): boolean => {
    const t = typeof iso === "string" ? Date.parse(iso) : NaN;
    return Number.isFinite(t) && Date.now() - t > 2 * 3600_000;
  };
  const sevOf = (r: Record<string, unknown>): number => {
    const ai = r.ai_json as { suggestion?: { severity?: unknown } } | null;
    return typeof ai?.suggestion?.severity === "number" ? ai.suggestion.severity : 0;
  };
  list.sort((a, b) => {
    const sa = a.category === "safety" ? 1 : 0;
    const sb = b.category === "safety" ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return sevOf(b) - sevOf(a);
  });
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>投訴審核隊列（{list.length}）</h1>
      <p>
        只列「待人工」案件；處理完的案件在 <Link href="/innerharbour/review/history">已處理記錄</Link>。
      </p>
      {openAlerts.length > 0 && (
        <section style={{ border: "2px solid crimson", padding: 12, marginBottom: 16 }} role="alert">
          <strong style={{ color: "crimson" }}>未處理的安全告警（{openAlerts.length}）</strong>
          <ul>
            {openAlerts.map((a) => (
              <li key={String(a.id)} style={{ color: overdue(a.created_at) ? "crimson" : undefined }}>
                <a href={`./review/${String(a.complaint_id)}`}>案件</a> · 已等待 {waitH(a.created_at)}
                {overdue(a.created_at) ? "（超過 2 小時）" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>等待</th>
            <th>類別</th>
            <th>狀態</th>
            <th>標記</th>
            <th>申訴</th>
            <th>建立</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={String(r.id)} style={{ borderTop: "1px solid #ccc" }}>
              <td style={{ color: r.category === "safety" && overdue(r.created_at) ? "crimson" : undefined }}>
                {waitH(r.created_at)}
              </td>
              <td>{String(r.category)}</td>
              <td>{String(r.status)}</td>
              <td>{Array.isArray(r.flags) ? (r.flags as unknown[]).join(",") : ""}</td>
              <td>{typeof r.appeal_status === "string" ? r.appeal_status : "-"}</td>
              <td>{String(r.created_at).slice(0, 16).replace("T", " ")}</td>
              <td>
                <a href={`./review/${String(r.id)}`}>詳情</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
