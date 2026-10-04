import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin, parseCheckinIdParam } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";
import { buildLikeJson } from "@/lib/api/likes";
import { isMinorDob } from "@/lib/api/cheers";

type PostRow = { id: string; user_id: string | null; visibility: unknown };

/**
 * UR E.10 batch2 打卡点赞 toggle（🔒，匿名 401）。
 * `POST /api/v1/checkins/:id/like` —— 有行即删（取消赞），无行即插；
 * 回 `{liked, like_count}`（计数实时，不存列）。
 * 可见门沿 E.7（public 直过；friends 走互好友；不可见 404 不泄归属）；
 * 隐身 403（沿 E.7 评论口径，点赞计数公开会暴露存在）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  // UR E.19 未成年禁写（赞／想喝／投分／回敬共用；dob 缺席放行）。
  const { data: minorRow } = await supabase
    .from("users")
    .select("dob")
    .eq("id", userId)
    .maybeSingle();
  if (isMinorDob((minorRow as { dob?: unknown } | null)?.dob, Date.now())) {
    return apiError("forbidden", "未滿 18 歲不可點贊", 403);
  }
  const { id } = await params;
  const parsedId = parseCheckinIdParam(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  // 帖存在＋可见（shape 沿 comments POST visible 口径，不复述注释）。
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
  // 隐身禁赞（沿 E.7；计数公开，赞即暴露）。
  const { data: meRow } = await supabase
    .from("users")
    .select("mode")
    .eq("id", userId)
    .maybeSingle();
  if ((meRow as { mode?: unknown } | null)?.mode === "stealth") {
    return apiError("forbidden", "隱身模式不可点赞", 403);
  }
  // toggle（RLS owner insert／delete 双保险；并发撞唯一键即视为已赞收敛）。
  const { data: existed } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", parsedId.id)
    .eq("user_id", userId)
    .maybeSingle();
  let liked: boolean;
  if (existed !== null) {
    const { error: dErr } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", parsedId.id)
      .eq("user_id", userId);
    if (dErr !== null) {
      console.error(`[api/v1/checkins/like] delete error: code=${dErr.code} message=${dErr.message}`);
      return apiError("internal", "取消点赞失败", 500);
    }
    liked = false;
  } else {
    const { error: iErr } = await supabase
      .from("post_likes")
      .insert({ post_id: parsedId.id, user_id: userId });
    if (iErr !== null) {
      // 23505 并发撞键：对方（几乎不可能是自己，单用户单帖串行）已插→收敛为已赞。
      if (iErr.code !== "23505") {
        console.error(`[api/v1/checkins/like] insert error: code=${iErr.code} message=${iErr.message}`);
        return apiError("internal", "点赞失败", 500);
      }
      liked = true;
    } else {
      liked = true;
    }
  }
  const { count } = await supabase
    .from("post_likes")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", parsedId.id);
  return apiOk(buildLikeJson(liked, count ?? 0));
}
