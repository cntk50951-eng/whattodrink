import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin, parseCheckinIdParam } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";
import { buildSaveJson } from "@/lib/api/saves";

type PostRow = { id: string; user_id: string | null; visibility: unknown };

/**
 * UR E.26 打卡收藏 toggle（🔒，匿名 401）。
 * `POST /api/v1/checkins/:id/save` —— 有行即删（取收），无行即插；回 `{saved}`（无 count，交接有意）。
 * 可见门沿 E.7（public 直过；friends 走互好友；不可见 404 不泄归属）。
 * 无未成年门（E.19 私人书签不触发）／无 stealth 门（无公开计数，不泄存在）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  const parsedId = parseCheckinIdParam(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  // 帖存在＋可见（shape 沿 like POST 口径；删帖即 post null→404，列表侧 inner 同理消失）。
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
  // toggle（RLS owner insert／delete 双保险；联合主键幂等，23505 收敛已收藏）。
  const { data: existed } = await supabase
    .from("checkin_saves")
    .select("checkin_id")
    .eq("checkin_id", parsedId.id)
    .eq("user_id", userId)
    .maybeSingle();
  let saved: boolean;
  if (existed !== null) {
    const { error: dErr } = await supabase
      .from("checkin_saves")
      .delete()
      .eq("checkin_id", parsedId.id)
      .eq("user_id", userId);
    if (dErr !== null) {
      console.error(`[api/v1/checkins/save] delete error: code=${dErr.code} message=${dErr.message}`);
      return apiError("internal", "取消收藏失败", 500);
    }
    saved = false;
  } else {
    const { error: iErr } = await supabase
      .from("checkin_saves")
      .insert({ checkin_id: parsedId.id, user_id: userId });
    if (iErr !== null) {
      if (iErr.code !== "23505") {
        console.error(`[api/v1/checkins/save] insert error: code=${iErr.code} message=${iErr.message}`);
        return apiError("internal", "收藏失败", 500);
      }
      saved = true;
    } else {
      saved = true;
    }
  }
  return apiOk(buildSaveJson(saved));
}
