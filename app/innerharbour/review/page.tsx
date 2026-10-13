import { notFound } from "next/navigation";

import { createServiceClient } from "@/lib/supabase/server";
import { cookieSessionUserId, requireAdmin } from "@/lib/ops";

/* eslint-disable react-hooks/purity -- Server Component 整页门禁＋列表必须在 render 读库；无客户端交互，无其他写法。 */

/**
 * 內部審核隊列（UR E.31 C2；路徑隱蔽＋白名單，非管理員 404）。
 * status escalated／triaged，按 safety 優先、created 升序；显示等待时长与 flags。
 */
export default async function ReviewQueuePage() {
  // 清單 A3：只認 cookie 會話（Bearer 到此即止）。
  const userId = await cookieSessionUserId();
  if (userId === null) notFound();
  const svc = await createServiceClient();
  if (!(await requireAdmin(svc, userId))) notFound();
  const { data: rows } = await svc
    .from("complaints")
    .select("id,party_id,filer_id,target_id,category,status,flags,appeal_status,created_at,ai_json")
    .in("status", ["escalated", "triaged"])
    .order("created_at", { ascending: true })
    .limit(200);
  const list = ((rows ?? []) as unknown[]) as Record<string, unknown>[];
  const waitH = (iso: unknown): string => {
    const t = typeof iso === "string" ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t)) return "-";
    const h = (Date.now() - t) / 3600_000;
    return h < 1 ? `${Math.round(h * 60)}分` : `${Math.round(h * 10) / 10}h`;
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
              <td style={{ color: r.category === "safety" && waitH(r.created_at).endsWith("h") ? "red" : undefined }}>
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
