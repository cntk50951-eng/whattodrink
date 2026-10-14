import Link from "next/link";

import { requireAdminPage } from "@/lib/opsPage";
import { decisionLabel } from "@/lib/reviewContext";

export const metadata = { robots: { index: false, follow: false } };

const FILTERS: { key: string; label: string; statuses: string[] }[] = [
  { key: "all", label: "全部已處理", statuses: ["upheld", "dismissed", "malicious"] },
  { key: "upheld", label: "成立", statuses: ["upheld"] },
  { key: "dismissed", label: "駁回", statuses: ["dismissed"] },
  { key: "malicious", label: "惡意", statuses: ["malicious"] },
];

function fmt(iso: unknown): string {
  return typeof iso === "string" ? iso.slice(0, 16).replace("T", " ") : "—";
}

/**
 * 已處理案件記錄（UR E.31 C2）：隊列只列「待人工」，處理完的案件從隊列消失；這裡按處理時間倒序列出已判定的案件，
 * 點進去看判定記錄（誰判、何時、理由、備註、積分變化、處理軌跡）。白名單＋TOTP，非管理員 404。
 */
export default async function ReviewHistoryPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { svc } = await requireAdminPage({}, "/innerharbour/review/history");
  const { s } = await searchParams;
  const active = FILTERS.find((f) => f.key === s) ?? FILTERS[0];
  const { data: rows } = await svc
    .from("complaints")
    .select("id,category,status,decision,filer_id,target_id,decided_by,decided_at,appeal_status,public_reason")
    .in("status", active.statuses)
    .order("decided_at", { ascending: false })
    .limit(200);
  const list = ((rows ?? []) as unknown[]) as Record<string, unknown>[];
  const ids = new Set<string>();
  for (const r of list) {
    for (const v of [r.filer_id, r.target_id]) if (typeof v === "string") ids.add(v);
    if (typeof r.decided_by === "string" && r.decided_by.startsWith("human:")) ids.add(r.decided_by.slice(6));
  }
  const { data: users } = ids.size > 0 ? await svc.from("users").select("id,nickname").in("id", [...ids].slice(0, 600)) : { data: [] };
  const nick = new Map<string, string>();
  for (const u of ((users ?? []) as unknown[]) as Record<string, unknown>[]) {
    if (typeof u.id === "string") nick.set(u.id, typeof u.nickname === "string" && u.nickname !== "" ? u.nickname : "酒友");
  }
  const name = (v: unknown): string => (typeof v === "string" ? (nick.get(v) ?? `用戶 ${v.slice(0, 8)}`) : "—");
  const by = (v: unknown): string =>
    typeof v === "string" && v.startsWith("human:") ? `審核員 ${name(v.slice(6))}` : v === "ai" ? "AI" : "—";
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <p>
        <Link href="/innerharbour/review">← 待處理隊列</Link>
      </p>
      <h1>已處理案件記錄（{list.length}）</h1>
      <p>
        {FILTERS.map((f) => (
          <span key={f.key} style={{ marginRight: 12 }}>
            {f.key === active.key ? (
              <strong>{f.label}</strong>
            ) : (
              <Link href={`/innerharbour/review/history?s=${f.key}`}>{f.label}</Link>
            )}
          </span>
        ))}
      </p>
      <table cellPadding={6}>
        <thead>
          <tr>
            <th>處理時間</th>
            <th>結果</th>
            <th>類別</th>
            <th>投訴人</th>
            <th>被投訴人</th>
            <th>處理人</th>
            <th>申訴</th>
            <th>詳情</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={String(r.id)} style={{ borderTop: "1px solid #ddd" }}>
              <td>{fmt(r.decided_at)}</td>
              <td>{decisionLabel(typeof r.decision === "string" ? r.decision : null)}</td>
              <td>{String(r.category)}</td>
              <td>{name(r.filer_id)}</td>
              <td>{name(r.target_id)}</td>
              <td>{by(r.decided_by)}</td>
              <td>{typeof r.appeal_status === "string" ? r.appeal_status : "-"}</td>
              <td>
                <Link href={`/innerharbour/review/${String(r.id)}`}>查看</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p>（還沒有已處理的案件）</p>}
    </main>
  );
}
