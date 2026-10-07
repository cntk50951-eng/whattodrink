import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin } from "@/lib/api/checkins";
import { type FriendshipRow, friendIdsOf } from "@/lib/friends";
import { cheersQuota, isMinorDob, parseCheersBody, parseCheersMessage } from "@/lib/api/cheers";

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
  // UR E.19 未成年禁写（共用 isMinorDob；dob 缺席放行，首登闸另管）。
  const { data: fromRow } = await supabase
    .from("users")
    .select("dob")
    .eq("id", userId)
    .maybeSingle();
  if (isMinorDob((fromRow as { dob?: unknown } | null)?.dob, Date.now())) {
    return apiError("forbidden", "未滿 18 歲不可乾杯", 403);
  }
  // UR E.14 round-5 防重刷：已敬過即 200 冪等（不重計、不額扣 quota；
  // 限額之前判，滿額重發舊敬仍 200，沿 iOS-0.53 口径）。
  const { data: dupRow } = await supabase
    .from("cheers")
    .select("id")
    .eq("from_user_id", userId)
    .eq("checkin_id", targetPost.id)
    .maybeSingle();
  const dayStart = hkDayStartISO(Date.now());
  if (dupRow !== null) {
    const { count: todayCount } = await supabase
      .from("cheers")
      .select("id", { count: "exact", head: true })
      .eq("from_user_id", userId)
      .gte("created_at", dayStart);
    const { count: postCount } = await supabase
      .from("cheers")
      .select("id", { count: "exact", head: true })
      .eq("checkin_id", targetPost.id);
    const quota = cheersQuota(todayCount ?? 0);
    return apiOk({
      cheered: true,
      remaining: quota.remaining,
      cheers_count: typeof postCount === "number" && postCount > 0 ? postCount : 1,
    });
  }
  // 15／天（HK自然天；RLS 只管行归属，限额路由强制）。
  const { count: todayCount } = await supabase
    .from("cheers")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", userId)
    .gte("created_at", dayStart);
  const quota = cheersQuota(todayCount ?? 0);
  if (!quota.ok) {
    return apiError("rate_limited", "今日乾杯已達上限", 429);
  }
  const { error: iErr } = await supabase.from("cheers").insert({
    from_user_id: userId,
    to_user_id: toUserId,
    checkin_id: targetPost.id,
    message: parseCheersMessage((raw as Record<string, unknown>).message),
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

/**
 * UR E.14 round-5 取消碰杯（🔒，沿 POST 认证口径；iOS-0.53 联调）。
 * `DELETE /api/v1/cheers {checkin_id}` —— 删 viewer 在该帖的碰杯行。
 * 只验 owner（`from_user_id == viewer`），不判 stealth／未成年
 * （删除不是新互动，旧行是当时合法产生）；
 * 有帖无行也 200 幂等（`{cheered:false, cheers_count}`）；404 只＝帖不存在／无权
 * （沿 POST 不泄归属口径；iOS 404＝帖问题，toast 对齐此口径）。
 */
export async function DELETE(req: Request): Promise<Response> {
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
  const cid = (raw as Record<string, unknown>).checkin_id;
  if (typeof cid !== "string" || cid === "" || cid.length > 64) {
    return apiError("invalid_params", "checkin_id 非法", 400);
  }
  // 帖存在＋可见（沿 POST 口径；不可见 404 不泄归属）。
  const { data: postRaw } = await supabase
    .from("checkins")
    .select("id,user_id,visibility")
    .eq("id", cid)
    .maybeSingle();
  const post = postRaw as { id: string; user_id: string | null; visibility: unknown } | null;
  if (post === null) {
    return apiError("not_found", "打卡不存在", 404);
  }
  if (post.user_id !== userId && post.visibility !== "public") {
    let friendIds: string[] = [];
    if (post.visibility === "friends") {
      const { data: fsRows } = await supabase
        .from("friendships")
        .select("user_id,friend_id,status")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .limit(200);
      const rows = ((fsRows ?? []) as unknown[]).filter(
        (r): r is FriendshipRow =>
          typeof r === "object" &&
          r !== null &&
          "user_id" in (r as Record<string, unknown>),
      );
      friendIds = friendIdsOf(userId, rows);
    }
    if (!canViewCheckin(userId, post.user_id, post.visibility, friendIds)) {
      return apiError("not_found", "打卡不存在", 404);
    }
  }
  // 只删自己的行（owner 验；无行即 200 幂等，不 404）。
  await supabase
    .from("cheers")
    .delete()
    .eq("checkin_id", cid)
    .eq("from_user_id", userId);
  const { count } = await supabase
    .from("cheers")
    .select("id", { count: "exact", head: true })
    .eq("checkin_id", cid);
  return apiOk({
    cheered: false,
    cheers_count: typeof count === "number" && count > 0 ? count : 0,
  });
}
