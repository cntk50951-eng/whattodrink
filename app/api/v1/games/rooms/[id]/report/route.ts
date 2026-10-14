import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { moderateCheckin, moderationAction } from "@/lib/moderation";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 每人每日举报上限（滚动 24h）。 */
const GAME_REPORT_DAILY_CAP = 10;

/**
 * UR H.2 举报玩家（🔒，都曾是该房 active 成员，含已离开／被踢）。
 * `POST /api/v1/games/rooms/:id/report {target_user_id, category, detail?, message_id?}`
 * —— 不能举报自己；同房同对一次（409）；快照最近 20 条（昵称匿名甲乙…，保留 7 天，
 *   快照随举报单走，删消息不影响已存快照）。
 * 举报触发 AI 复核（after 异步）：只审被举报人消息，一举报一调用、同房同人只一次；
 * 命中即撤回＋`ai_flagged`＋置顶；未命中／AI 不可用不撤回照常进队列；
 * ≥2 不同玩家举报即禁言到本房结束。第一版只记录，不扣诚信分。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const target = r.target_user_id;
  if (typeof target !== "string" || target.trim() === "" || target.length > 64) {
    return apiError("invalid_params", "target_user_id 非法", 400);
  }
  const targetId = target.trim();
  if (targetId === userId) {
    return apiError("invalid_params", "不可舉報自己", 400);
  }
  const category = r.category;
  if (category !== "harassment" && category !== "cheating" && category !== "inappropriate" && category !== "other" && category !== "safety") {
    return apiError("invalid_params", "category 非法", 400);
  }
  const detailRaw = r.detail;
  const detail = typeof detailRaw === "string" ? detailRaw.trim() : "";
  if (detail !== "" && detail.length > 200) {
    return apiError("invalid_params", "detail 最多 200 字", 400);
  }
  const messageId = typeof r.message_id === "string" && r.message_id !== "" ? r.message_id : null;
  const { id } = await params;
  const svc = await createServiceClient();
  // 资格：双方都曾是 active 成员（game_room_players 有行即可，left/kicked 亦算）。
  const { data: pairRows } = await svc
    .from("game_room_players")
    .select("user_id")
    .eq("room_id", id)
    .in("user_id", [userId, targetId])
    .limit(2);
  const found = new Set(
    ((pairRows ?? []) as unknown[]).map((x) => (x as { user_id?: unknown }).user_id).filter((v): v is string => typeof v === "string"),
  );
  if (!found.has(userId) || !found.has(targetId)) {
    return apiError("not_allowed", "雙方須都曾是該房成員", 403);
  }
  // 每人每日 ≤10 条（滚动 24h；防刷举报）。
  const { count: dayCount } = await svc
    .from("game_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", userId)
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((dayCount ?? 0) >= GAME_REPORT_DAILY_CAP) {
    return apiError("rate_limited", "今日舉報已達上限（10 條）", 429);
  }
  const { data: inserted, error: iErr } = await svc
    .from("game_reports")
    .insert({
      room_id: id,
      reporter_id: userId,
      target_id: targetId,
      category,
      detail: detail === "" ? null : detail,
      message_id: messageId,
    })
    .select("id")
    .single();
  if (iErr !== null || inserted === null) {
    if (iErr?.code === "23505") {
      return apiError("invalid_params", "該房對該玩家已舉報過", 409);
    }
    console.error(`[games/report] insert error: code=${iErr?.code} message=${iErr?.message}`);
    return apiError("internal", "舉報失敗", 500);
  }
  const reportId = (inserted as { id: string }).id;
  // 快照最近 20 条（昵称匿名化甲乙丙…；只存快照，不存 id 映射）。
  const { data: recent } = await svc
    .from("game_room_messages")
    .select("user_id,kind,body,quick_key,created_at")
    .eq("room_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  const anon = new Map<string, string>();
  const names = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  let anonIdx = 0;
  const snapshot = (((recent ?? []) as unknown[]) as Record<string, unknown>[]).reverse().map((m) => {
    const uid = typeof m.user_id === "string" ? m.user_id : "";
    if (!anon.has(uid)) {
      anon.set(uid, names[anonIdx % names.length]);
      anonIdx += 1;
    }
    return {
      who: anon.get(uid),
      kind: m.kind,
      text: m.kind === "quick" ? m.quick_key : m.body,
      at: m.created_at,
    };
  });
  await svc.from("game_reports").update({ snapshot }).eq("id", reportId);
  // AI 复核（after 语义，不阻塞响应）：只审被举报人最近消息，一举报一调用；
  // 同房同人已有复核即跳过；命中撤回＋ai_flagged；失败照常进队列；
  // ≥2 不同玩家举报即禁言到本房结束。
  void reviewReportedUser(svc, id, targetId, reportId);
  return apiOk({ id: reportId }, 201);
}

/**
 * 被举报人 AI 复核（UR H.2 §3：成本只随举报量发生）。
 * 用现有 moderateCheckin（OpenAI 主审＋MiniMax 兜底），最近 10 条文本逐条判定。
 */
async function reviewReportedUser(
  svc: SupabaseClient,
  roomId: string,
  targetId: string,
  reportId: string,
): Promise<void> {
  try {
    const { data: done } = await svc
      .from("game_reports")
      .select("id")
      .eq("room_id", roomId)
      .eq("target_id", targetId)
      .not("ai_reviewed_at", "is", null)
      .limit(1);
    if (Array.isArray(done) && done.length > 0) return;
    const { data: msgs } = await svc
      .from("game_room_messages")
      .select("id,body")
      .eq("room_id", roomId)
      .eq("user_id", targetId)
      .eq("kind", "text")
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    const texts = (((msgs ?? []) as unknown[]) as { id?: unknown; body?: unknown }[]).filter(
      (m): m is { id: string; body: string } =>
        typeof m.id === "string" && typeof m.body === "string" && m.body.trim() !== "",
    );
    let hit = false;
    for (const m of texts) {
      try {
        const verdict = await moderateCheckin(
          { text: m.body },
          {
            openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
            minimaxKey: process.env.minimaxi_api_key,
            minimaxBaseUrl: process.env.MINIMAX_API_BASE,
          },
        );
        if (moderationAction(verdict) !== "reject") continue;
        hit = true;
        await svc
          .from("game_room_messages")
          .update({ removed_at: new Date().toISOString(), removed_reason: "ai_flagged" })
          .eq("id", m.id);
      } catch (err) {
        console.error(`[games/report] review item error: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    await svc
      .from("game_reports")
      .update({ ai_reviewed_at: new Date().toISOString(), ...(hit ? { ai_flagged: true } : {}) })
      .eq("id", reportId);
    // 多人举报升级：同房同人 ≥2 不同玩家 → 禁言到本房结束。
    const { data: reporters } = await svc
      .from("game_reports")
      .select("reporter_id")
      .eq("room_id", roomId)
      .eq("target_id", targetId)
      .limit(10);
    const distinct = new Set(
      ((reporters ?? []) as unknown[]).map((r) => (r as { reporter_id?: unknown }).reporter_id).filter((v): v is string => typeof v === "string"),
    );
    if (distinct.size >= 2) {
      await svc.from("game_mutes").upsert(
        { room_id: roomId, user_id: targetId },
        { onConflict: "room_id,user_id" },
      );
    }
  } catch (err) {
    console.error(`[games/report] review error: ${err instanceof Error ? err.message : "unknown"}`);
  }
}
