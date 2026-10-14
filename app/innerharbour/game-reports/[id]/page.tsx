import Link from "next/link";
import { notFound } from "next/navigation";

import { adminRateLimited, auditOrThrow, auditViewOnce, checkSameOrigin } from "@/lib/ops";
import { requireAdminPage } from "@/lib/opsPage";

export const metadata = { robots: { index: false, follow: false } };

const STATES = ["reviewed", "actioned", "dismissed"] as const;

/**
 * 遊戲舉報詳情＋標記（UR H.2；白名單＋TOTP，非管理員 404）。
 * 快照匿名（甲乙…）；moderator 可標記 reviewed/actioned/dismissed＋禁玩 N 天；
 * 只讀 viewer 只能看。寫操作先寫審計（失敗即中止）。
 */
export default async function GameReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, role, svc } = await requireAdminPage({}, `/innerharbour/game-reports/${id}`);
  const { data: rRaw } = await svc.from("game_reports").select("*").eq("id", id).maybeSingle();
  const r = rRaw as Record<string, unknown> | null;
  if (r === null) notFound();
  await auditViewOnce(svc, { admin_id: userId, action: "view_game_report", target: id });

  async function mark(formData: FormData): Promise<void> {
    "use server";
    const g = await requireAdminPage({ write: true, stepUp: true }, `/innerharbour/game-reports/${id}`);
    if (!(await checkSameOrigin())) throw new Error("跨站請求被拒");
    const state = String(formData.get("state") ?? "");
    if (!(STATES as readonly string[]).includes(state)) throw new Error("狀態非法");
    const banDays = Math.floor(Number(formData.get("ban_days") ?? 0));
    if (!Number.isFinite(banDays) || banDays < 0 || banDays > 365) throw new Error("禁玩天數非法");
    if (await adminRateLimited(g.svc, g.userId, ["game_report_mark"], 30, 600_000)) {
      throw new Error("操作過於頻繁，請稍後再試");
    }
    await auditOrThrow(g.svc, {
      admin_id: g.userId,
      action: `game_report_${state}`,
      target: id,
      detail: { ban_days: banDays },
    });
    const { error } = await g.svc
      .from("game_reports")
      .update({ status: state, decided_by: g.userId, decided_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["pending", "reviewed"]);
    if (error !== null) throw new Error("標記失敗（可能已被處理）");
    if (banDays > 0) {
      const target = String((await g.svc.from("game_reports").select("target_id").eq("id", id).maybeSingle() as { target_id?: unknown } | null)?.target_id ?? "");
      if (target !== "") {
        const { banGameUser } = await import("@/lib/complaintDecision");
        await banGameUser(g.svc, target, banDays);
        await auditOrThrow(g.svc, {
          admin_id: g.userId,
          action: "game_ban",
          target,
          detail: { days: banDays, report: id },
        });
      }
    }
  }

  const snapshot = Array.isArray(r.snapshot) ? (r.snapshot as unknown[]) : [];
  return (
    <main style={{ padding: 24 }}>
      <p>
        <Link href="/innerharbour/game-reports">← 隊列</Link>
      </p>
      <h1>
        {String(r.category)} · {String(r.status)}
        {r.ai_flagged === true ? " · AI 標記" : ""}
      </h1>
      <p>房間：{String(r.room_id)} ｜ 舉報人：{String(r.reporter_id)} ｜ 被舉報：{String(r.target_id)}</p>
      <p>說明：{typeof r.detail === "string" && r.detail !== "" ? r.detail : "（無）"}</p>
      <h2>快照（匿名）</h2>
      <ul>
        {snapshot.map((m, i) => {
          const msg = (typeof m === "object" && m !== null ? m : {}) as Record<string, unknown>;
          return (
            <li key={i}>
              {String(msg.who ?? "?")}：{String(msg.text ?? "")} · {String(msg.at ?? "")}
            </li>
          );
        })}
      </ul>
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
          <label>
            禁玩天數（0＝不禁）：
            <input name="ban_days" type="number" min={0} max={365} defaultValue={0} />
          </label>{" "}
          <button type="submit">提交</button>
        </form>
      ) : (
        <p>只讀權限：標記請找 moderator。</p>
      )}
    </main>
  );
}
