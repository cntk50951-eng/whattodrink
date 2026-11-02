import Link from "next/link";
import { after } from "next/server";

import { requireAdminPage } from "@/lib/opsPage";
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
export default async function UserReportsPage() {
  const { svc } = await requireAdminPage({}, "/innerharbour/user-reports");
  after(async () => {
    const cutoff = new Date(Date.now() - SNAPSHOT_KEEP_DAYS * 24 * 3600_000).toISOString();
    await svc.from("cheers_reports").update({ snapshot: null }).lt("created_at", cutoff).neq("status", "pending").not("snapshot", "is", null);
  });
  const { data: rows } = await svc
    .from("cheers_reports")
    .select("id,target_type,reason_code,reason,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const list = ((((rows ?? []) as unknown[]) as Record<string, unknown>[]).slice()).sort(
    (a, b) => reportRank(a) - reportRank(b) || String(b.created_at).localeCompare(String(a.created_at)),
  );
  const pending = list.filter((r) => r.status === "pending");
  const urgent = pending.filter((r) => r.reason_code === "underage");
  return (
    <main style={{ padding: 24 }}>
      <h1>用戶舉報（待處理 {pending.length}／共 {list.length}）</h1>
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
                {TYPE_LABEL[String(r.target_type)] ?? String(r.target_type)} · {REASON_LABEL[code] ?? "未填原因"} · {String(r.status)} · {String(r.created_at)}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
