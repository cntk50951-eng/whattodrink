import Link from "next/link";
import { after } from "next/server";

import { requireAdminPage } from "@/lib/opsPage";

/* eslint-disable react-hooks/purity -- Server Component 整页门禁＋读库＋懒清理必须在 render 内读时间；无客户端交互。 */

export const metadata = { robots: { index: false, follow: false } };

/** 已處理的舉報，快照保留天數（證據過期即清；pending 的不清，免得還沒審就沒證據）。 */
const SNAPSHOT_KEEP_DAYS = 7;

/**
 * 遊戲舉報隊列（UR H.2；白名單，非管理員 404）。
 * 排序：**人身安全（safety）最前** → AI 命中 → 其餘；同級按時間新到舊。只讀 viewer 可看。
 * 順帶懶清已處理舉報的過期快照（7 天）。
 */
export default async function GameReportsPage() {
  const { svc } = await requireAdminPage({}, "/innerharbour/game-reports");
  after(async () => {
    const cutoff = new Date(Date.now() - SNAPSHOT_KEEP_DAYS * 24 * 3600_000).toISOString();
    await svc.from("game_reports").update({ snapshot: null }).lt("created_at", cutoff).neq("status", "pending").not("snapshot", "is", null);
  });
  const { data: rows } = await svc
    .from("game_reports")
    .select("id,room_id,reporter_id,target_id,category,status,ai_flagged,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rank = (r: Record<string, unknown>): number =>
    (r.status === "pending" ? 0 : 10) + (r.category === "safety" ? 0 : r.ai_flagged === true ? 1 : 2);
  const list = ((((rows ?? []) as unknown[]) as Record<string, unknown>[]).slice()).sort(
    (a, b) => rank(a) - rank(b) || String(b.created_at).localeCompare(String(a.created_at)),
  );
  const openSafety = list.filter((r) => r.category === "safety" && r.status === "pending");
  return (
    <main style={{ padding: 24 }}>
      <h1>遊戲舉報（{list.length}）</h1>
      {openSafety.length > 0 && (
        <p role="alert" style={{ border: "2px solid crimson", padding: 12, color: "crimson", fontWeight: 700 }}>
          有 {openSafety.length} 條未處理的「人身安全」舉報，請優先處理。
        </p>
      )}
      <ul>
        {list.map((r) => (
          <li key={String(r.id)} style={r.category === "safety" && r.status === "pending" ? { color: "crimson" } : undefined}>
            <Link href={`/innerharbour/game-reports/${String(r.id)}`}>
              {r.category === "safety" ? "【安全】" : ""}
              {String(r.category)} · {String(r.status)}
              {r.ai_flagged === true ? " · AI" : ""} · {String(r.created_at)}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
