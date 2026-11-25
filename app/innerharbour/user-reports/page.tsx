import Link from "next/link";
import { after } from "next/server";

import { OpsNav } from "@/components/innerharbour/OpsNav";
import { requireAdminPage } from "@/lib/opsPage";
import { REPORT_ROUTE_REASON_TEXT, type ReportRouteReason } from "@/lib/reportTriage";
import { reportRank } from "@/lib/userReports";

/* eslint-disable react-hooks/purity -- Server Component 整页门禁＋读库＋懒清理必须在 render 内读时间；无客户端交互。 */

export const metadata = { robots: { index: false, follow: false } };

/** 已處理的舉報，證據快照保留天數（過期即清；待處理的不清，免得還沒審就沒證據）。 */
const SNAPSHOT_KEEP_DAYS = 7;

const TYPE_LABEL: Record<string, string> = { user: "用戶", post: "帖子", message: "聊天訊息" };
const REASON_LABEL: Record<string, string> = {
  harassment: "騷擾／言語冒犯",
  inappropriate: "不當內容",
  spam: "垃圾訊息／詐騙",
  underage: "疑似未滿 18 歲",
  other: "其他",
};

/**
 * 用戶／帖子／聊天訊息舉報隊列（Apple 1.2：舉報要有人處理；白名單，非管理員 404）。
 * 排序：待處理在前；同狀態「疑似未成年」最前，其次騷擾／不當內容；同級按時間新到舊。只讀 viewer 可看。
 * 順帶懶清已處理舉報的過期證據快照（7 天）。
 */
/** AI 分流標籤（0090；舊案件無欄位＝不顯示） */
function aiLabel(r: Record<string, unknown>): string {
  const score = typeof r.ai_score === "number" ? ` ${r.ai_score.toFixed(2)}` : "";
  if (r.ai_decision === "auto_actioned") return `AI 自動處分${score}`;
  if (r.ai_decision === "auto_dismissed") return `AI 自動結案${score}`;
  if (r.ai_decision === "human") {
    const why = REPORT_ROUTE_REASON_TEXT[String(r.ai_route_reason) as ReportRouteReason] ?? "";
    return `轉人工${score}${why !== "" ? `（${why}）` : ""}`;
  }
  return "";
}

export default async function UserReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const humanOnly = view === "human";
  const { role, svc } = await requireAdminPage({}, "/innerharbour/user-reports");
  after(async () => {
    const cutoff = new Date(Date.now() - SNAPSHOT_KEEP_DAYS * 24 * 3600_000).toISOString();
    await svc.from("cheers_reports").update({ snapshot: null }).lt("created_at", cutoff).neq("status", "pending").not("snapshot", "is", null);
  });
  const read = (cols: string) => svc.from("cheers_reports").select(cols).order("created_at", { ascending: false }).limit(200);
  let { data: rows, error } = await read("id,target_type,reason_code,reason,status,created_at,ai_decision,ai_score,ai_route_reason,support_emailed_at");
  if (error !== null && (error.code === "42703" || error.code === "PGRST204")) {
    ({ data: rows, error } = await read("id,target_type,reason_code,reason,status,created_at"));
  }
  const all = (((rows ?? []) as unknown[]) as Record<string, unknown>[]).slice();
  // 「待人工」：還沒結案、且 AI 分流到人工（或舊案件沒有 AI 紀錄）
  const needsHuman = (r: Record<string, unknown>) =>
    (r.status === "pending" || r.status === "reviewed") && (r.ai_decision === "human" || r.ai_decision === undefined || r.ai_decision === null);
  const list = (humanOnly ? all.filter(needsHuman) : all).sort(
    (a, b) => reportRank(a) - reportRank(b) || String(b.created_at).localeCompare(String(a.created_at)),
  );
  const pending = list.filter((r) => r.status === "pending");
  const urgent = pending.filter((r) => r.reason_code === "underage");
  return (
    <div>
      <OpsNav active="user-reports" role={role} />
      <main style={{ padding: 24 }}>
      <h1>用戶舉報（待處理 {pending.length}／共 {list.length}）</h1>
      <p>
        {humanOnly ? <Link href="/innerharbour/user-reports">全部</Link> : <strong>全部</strong>}
        {" ｜ "}
        {humanOnly ? <strong>待人工 {all.filter(needsHuman).length}</strong> : <Link href="/innerharbour/user-reports?view=human">待人工 {all.filter(needsHuman).length}</Link>}
      </p>
      {urgent.length > 0 && (
        <p role="alert" style={{ border: "2px solid crimson", padding: 12, color: "crimson", fontWeight: 700 }}>
          有 {urgent.length} 條未處理的「疑似未滿 18 歲」舉報，請優先處理。
        </p>
      )}
      <ul>
        {list.map((r) => {
          const code = typeof r.reason_code === "string" ? r.reason_code : "";
          const hot = r.status === "pending" && code === "underage";
          return (
            <li key={String(r.id)} style={hot ? { color: "crimson" } : undefined}>
              <Link href={`/innerharbour/user-reports/${String(r.id)}`}>
                {hot ? "【未成年】" : ""}
                {TYPE_LABEL[String(r.target_type)] ?? String(r.target_type)} · {REASON_LABEL[code] ?? "未填原因"} · {String(r.status)}
                {aiLabel(r) !== "" ? ` · ${aiLabel(r)}` : ""} · {String(r.created_at)}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
    </div>
  );
}
