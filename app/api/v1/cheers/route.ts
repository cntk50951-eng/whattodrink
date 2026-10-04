import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin } from "@/lib/api/checkins";
import { type FriendshipRow, friendIdsOf } from "@/lib/friends";
import { cheersQuota, parseCheersBody } from "@/lib/api/cheers";

type CheckinRow = {
  id: string;
  user_id: string | null;
  visibility: unknown;
  created_at: string;
};

/** HK 今日 0 点 UTC ISO（服务端 15／天窗口下界，沿 hkTodayKey 口径）。 */
function hkDayStartISO(nowMs: number): string {
  const hk = new Date(nowMs + 8 * 3600_000);
  hk.setUTCHours(0, 0, 0, 0);
  return new Date(hk.getTime() - 8 * 3600_000).toISOString();
}

async function friendIdsFor(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").getAuthedClient>>["supabase"],
  viewerId: string,
): Promise<string[]> {
  const { data: fsRows } = await supabase
    .from("friendships")
    .select("user_id,friend_id,status")
    .or(`user_id.eq.${viewerId},friend_id.eq.${viewerId}`)
    .limit(200);
  const rows = ((fsRows ?? []) as unknown[]).filter(
    (r): r is FriendshipRow =>
      typeof r === "object" && r !== null && "user_id" in (r as Record<string, unknown>),
  );
  return friendIdsOf(viewerId, rows);
}

/**
 * UR E.14 敬酒（🔒，匿名 401；隐身 403 沿旧门）。
 * `POST /api/v1/cheers {checkin_id}｜{to_user_id}` 二选一：
 * 前者敬该帖作者，后者回敬（服务端解对方最新可见帖，无帖 404）。
 * 自敬 403；15／天（HK）超限 429；回 `{cheered, remaining, cheers_count}`。
 */
export async function POST(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseCheersBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  // 隐身禁敬（沿旧门；敬酒具名，隐身敬即暴露）。
  const { data: meRow } = await supabase
    .from("users")
    .select("mode")
    .eq("id", userId)
    .maybeSingle();
  if ((meRow as { mode?: unknown } | null)?.mode === "stealth") {
    return apiError("forbidden", "隱身模式不可乾杯", 403);
  }
  // 定靶：敬帖解作者；回敬解对方最新可见帖。
  let targetPost: CheckinRow | null = null;
  let toUserId: string | null = null;
  if (parsed.checkin_id !== undefined) {
    const { data: postRaw } = await supabase
      .from("checkins")
      .select("id,user_id,visibility,created_at")
      .eq("id", parsed.checkin_id)
      .maybeSingle();
    const post = postRaw as CheckinRow | null;
    if (post === null) return apiError("not_found", "打卡不存在", 404);
    if (post.visibility !== "public") {
      const fids = post.visibility === "friends" ? await friendIdsFor(supabase, userId) : [];
      if (!canViewCheckin(userId, post.user_id, post.visibility, fids)) {
        return apiError("not_found", "打卡不存在", 404);
      }
    }
    targetPost = post;
    toUserId = post.user_id;
  } else {
    const peerId = parsed.to_user_id as string;
    const { data: peerRow } = await supabase
      .from("users")
      .select("id")
      .eq("id", peerId)
      .maybeSingle();
    if (peerRow === null) return apiError("not_found", "对方不存在", 404);
    const { data: posts } = await supabase
      .from("checkins")
      .select("id,user_id,visibility,created_at")
      .eq("user_id", peerId)
      .order("created_at", { ascending: false })
      .limit(20);
    const fids = await friendIdsFor(supabase, userId);
    const hit = ((posts ?? []) as CheckinRow[]).find((p) =>
      p.visibility === "public"
        ? true
        : canViewCheckin(userId, p.user_id, p.visibility, fids),
    );
    if (hit === undefined) return apiError("not_found", "對方暫無可敬的打卡", 404);
    targetPost = hit;
    toUserId = peerId;
  }
  if (toUserId === null || toUserId === userId) {
    return apiError("forbidden", "不可敬自己", 403);
  }
  // 15／天（HK自然天；RLS 只管行归属，限额路由强制）。
  const { count: todayCount } = await supabase
    .from("cheers")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", userId)
    .gte("created_at", hkDayStartISO(Date.now()));
  const quota = cheersQuota(todayCount ?? 0);
  if (!quota.ok) {
    return apiError("rate_limited", "今日乾杯已達上限", 429);
  }
  const { error: iErr } = await supabase.from("cheers").insert({
    from_user_id: userId,
    to_user_id: toUserId,
    checkin_id: targetPost.id,
  });
  if (iErr !== null) {
    console.error(`[api/v1/cheers] insert error: code=${iErr.code} message=${iErr.message}`);
    return apiError("internal", "乾杯失败", 500);
  }
  const { count: postCount } = await supabase
    .from("cheers")
    .select("id", { count: "exact", head: true })
    .eq("checkin_id", targetPost.id);
  return apiOk({
    cheered: true,
    remaining: quota.remaining - 1,
    cheers_count: typeof postCount === "number" && postCount > 0 ? postCount : 1,
  });
}
