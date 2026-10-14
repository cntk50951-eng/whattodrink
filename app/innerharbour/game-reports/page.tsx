import Link from "next/link";

import { requireAdminPage } from "@/lib/opsPage";

export const metadata = { robots: { index: false, follow: false } };

/**
 * 遊戲舉報隊列（UR H.2；白名單，非管理員 404）。
 * ai_flagged 置頂＋pending 在前；只讀 viewer 可看。
 */
export default async function GameReportsPage() {
  const { svc } = await requireAdminPage({}, "/innerharbour/game-reports");
  const { data: rows } = await svc
    .from("game_reports")
    .select("id,room_id,reporter_id,target_id,category,status,ai_flagged,created_at")
    .order("ai_flagged", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  const list = (((rows ?? []) as unknown[]) as Record<string, unknown>[]);
  return (
    <main style={{ padding: 24 }}>
      <h1>遊戲舉報（{list.length}）</h1>
      <ul>
        {list.map((r) => (
          <li key={String(r.id)}>
            <Link href={`/innerharbour/game-reports/${String(r.id)}`}>
              {String(r.category)} · {String(r.status)}
              {r.ai_flagged === true ? " · AI" : ""} · {String(r.created_at)}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
