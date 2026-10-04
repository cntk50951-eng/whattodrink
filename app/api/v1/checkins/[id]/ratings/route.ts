import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin, parseCheckinIdParam } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";
import { parseRatingBody, summarizeRatings } from "@/lib/api/rating";
import { isMinorDob } from "@/lib/api/cheers";

type PostRow = { id: string; user_id: string | null; visibility: unknown };

/**
 * UR E.12 他人制评分（🔒，匿名 401）。
 * `POST /api/v1/checkins/:id/ratings {rating: 1–5 | null}` —— 有行即覆盖（改分），
 * 无行即插；`null` 即删行（撤分）。回 `{rated, my_rating, rating_avg, rating_count}`。
 * 门（沿 like 口径）：帖存在＋可见（public 直过；friends 走互好友；不可见 404 不泄归属）；
 * 作者本人写一律 403（只看平均）；隐身 403（聚合公开，投即暴露）。
 * 聚合走 service client（路由已过可见门，沿 D.2 口径；RLS 只做纵深），
 * 只吐聚合＋本人行，不吐谁投几分。
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
    return apiError("forbidden", "未滿 18 歲不可打分", 403);
  }
  const { id } = await params;
  const parsedId = parseCheckinIdParam(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseRatingBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  // 帖存在＋可见（shape 沿 like 可见口径）。
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
  // 作者只看平均（归属已知，403 明拒不泄漏新信息）。
  if (post.user_id !== null && post.user_id === userId) {
    return apiError("forbidden", "作者不可给自己打分", 403);
  }
  // 隐身禁投（沿 like；聚合公开，投即暴露）。
  const { data: meRow } = await supabase
    .from("users")
    .select("mode")
    .eq("id", userId)
    .maybeSingle();
  if ((meRow as { mode?: unknown } | null)?.mode === "stealth") {
    return apiError("forbidden", "隱身模式不可打分", 403);
  }
  // 写（RLS owner insert／update／delete 三保险；upsert 天然一人一票）。
  const service = await createServiceClient();
  if (parsed.rating === null) {
    const { error: dErr } = await supabase
      .from("checkin_ratings")
      .delete()
      .eq("checkin_id", parsedId.id)
      .eq("user_id", userId);
    if (dErr !== null) {
      console.error(`[api/v1/checkins/ratings] delete error: code=${dErr.code} message=${dErr.message}`);
      return apiError("internal", "撤分失败", 500);
    }
  } else {
    const { error: uErr } = await supabase
      .from("checkin_ratings")
      .upsert(
        { checkin_id: parsedId.id, user_id: userId, rating: parsed.rating },
        { onConflict: "checkin_id,user_id" },
      );
    if (uErr !== null) {
      console.error(`[api/v1/checkins/ratings] upsert error: code=${uErr.code} message=${uErr.message}`);
      return apiError("internal", "打分失败", 500);
    }
  }
  // 聚合（service 读全表行；只吐聚合＋本人行）。
  const { data: rows, error: rErr } = await service
    .from("checkin_ratings")
    .select("user_id,rating")
    .eq("checkin_id", parsedId.id);
  if (rErr !== null) {
    console.error(`[api/v1/checkins/ratings] read error: code=${rErr.code} message=${rErr.message}`);
    return apiError("internal", "评分读取失败", 500);
  }
  const list = ((rows ?? []) as unknown[]).filter(
    (r): r is { user_id: unknown; rating: unknown } =>
      typeof r === "object" && r !== null && "rating" in (r as Record<string, unknown>),
  );
  const { avg, count } = summarizeRatings(list);
  const mine = list.find((r) => r.user_id === userId)?.rating;
  const myRating = typeof mine === "number" && Number.isInteger(mine) ? mine : null;
  return apiOk({
    rated: myRating !== null,
    my_rating: myRating,
    rating_avg: avg,
    rating_count: count,
  });
}
