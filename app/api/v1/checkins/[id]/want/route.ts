import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin, parseCheckinIdParam } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";
import { buildWantJson } from "@/lib/api/wants";
import { isMinorDob } from "@/lib/api/cheers";

type PostRow = { id: string; user_id: string | null; visibility: unknown };

/**
 * UR E.10 batch3 “我也想喝”计数 toggle（🔒，匿名 401）。
 * `POST /api/v1/checkins/:id/want` —— 有行即删（取消），无行即插；
 * 回 `{wanted, want_count}`（问答定案：仅计数，不进推荐，反哺另议）。
 * 可见门沿 batch2 like 口径（public 直过；friends 走互好友；不可见 404）；
 * 隐身 403（计数公开，点即暴露，沿 E.7）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  // UR E.19 未成年禁写（同 like 口径）。
  const { data: minorRow } = await supabase
    .from("users")
    .select("dob")
    .eq("id", userId)
    .maybeSingle();
  if (isMinorDob((minorRow as { dob?: unknown } | null)?.dob, Date.now())) {
    return apiError("forbidden", "未滿 18 歲不可想喝", 403);
  }
  const { id } = await params;
  const parsedId = parseCheckinIdParam(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  const { data: postRaw } = await supabase
    .from("checkins")
    .select("id,user_id,visibility")
    .eq("id", parsedId.id)
    .maybeSingle();
  const post = postRaw as PostRow | null;
  if (post === null) {
    return apiError("not_found", "打卡不存在", 404);
  }
  if (post.visibility !== "public") {
    let friendIds: string[] = [];
    if (post.visibility === "friends") {
      const { data: fsRows } = await supabase
        .from("friendships")
        .select("user_id,friend_id,status")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .limit(200);
      friendIds = friendIdsOf(
        userId,
        ((fsRows ?? []) as unknown[]) as {
          user_id: unknown;
          friend_id: unknown;
          status: unknown;
        }[],
      );
    }
    if (!canViewCheckin(userId, post.user_id, post.visibility, friendIds)) {
      return apiError("not_found", "打卡不存在", 404);
    }
  }
  const { data: meRow } = await supabase
    .from("users")
    .select("mode")
    .eq("id", userId)
    .maybeSingle();
  if ((meRow as { mode?: unknown } | null)?.mode === "stealth") {
    return apiError("forbidden", "隱身模式不可表态", 403);
  }
  // toggle（RLS owner insert／delete 双保险；并发撞双列 PK 即收敛为已想喝）。
  const { data: existed } = await supabase
    .from("checkin_wants")
    .select("checkin_id")
    .eq("checkin_id", parsedId.id)
    .eq("user_id", userId)
    .maybeSingle();
  let wanted: boolean;
  if (existed !== null) {
    const { error: dErr } = await supabase
      .from("checkin_wants")
      .delete()
      .eq("checkin_id", parsedId.id)
      .eq("user_id", userId);
    if (dErr !== null) {
      console.error(`[api/v1/checkins/want] delete error: code=${dErr.code} message=${dErr.message}`);
      return apiError("internal", "取消失败", 500);
    }
    wanted = false;
  } else {
    const { error: iErr } = await supabase
      .from("checkin_wants")
      .insert({ checkin_id: parsedId.id, user_id: userId });
    if (iErr !== null) {
      if (iErr.code !== "23505") {
        console.error(`[api/v1/checkins/want] insert error: code=${iErr.code} message=${iErr.message}`);
        return apiError("internal", "表态失败", 500);
      }
      wanted = true;
    } else {
      wanted = true;
    }
  }
  const { count } = await supabase
    .from("checkin_wants")
    .select("checkin_id", { count: "exact", head: true })
    .eq("checkin_id", parsedId.id);
  return apiOk(buildWantJson(wanted, count ?? 0));
}
