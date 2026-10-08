import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends, type FriendshipRow } from "@/lib/friends";
import { canViewCheckin, parseCheckinIdParam } from "@/lib/api/checkins";
import { summarizeRatings } from "@/lib/api/rating";

/**
 * UR E.2 打卡詳情（🔒）。
 * 他人點釘開卡時按需拉三件套（照片＋文字＋語音），pins 列表不帶（weight 考量，
 * 見 UR E.2）：`GET /api/v1/checkins/:id`。
 * 可見門：本人全見／public 全見／friends 僅互好友見，其餘 403（fail-closed）。
 */

const DETAIL_COLUMNS =
  "id,user_id,visibility,photo_url,note,audio_url,audio_seconds,transcript,created_at,place_name,lat,lng,beer_id,rating";

/**
 * UR E.22 歸檔回退（舊分享鏈／深鏈不斷；只讀快照，主缺才查）。
 * 門沿主口徑（本人全見／public 全見／friends 互好友；其餘 403）；
 * 明細子行搬家已散，只吐快照數，liked／wanted／rated 全假；`archived: true` 調用方置灰。
 * 歸檔表未遷移（0026 未跑）即 null，調用方沿舊 404。
 */
async function readArchived(
  supabase: Awaited<ReturnType<typeof getAuthedClient>>["supabase"],
  userId: string,
  id: string,
): Promise<Response | null> {
  const service = await createServiceClient();
  let arow: Record<string, unknown> | null = null;
  try {
    const { data, error } = await service
      .from("checkins_archive")
      .select(
        "id,user_id,visibility,photo_url,note,audio_url,audio_seconds,transcript,created_at,place_name,lat,lng,beer_id,rating_avg,rating_count,like_count,want_count,comment_count,cheers_count",
      )
      .eq("id", id)
      .maybeSingle();
    if (error !== null || data === null) return null;
    arow = data as Record<string, unknown>;
  } catch {
    return null;
  }
  const ownerId = typeof arow.user_id === "string" ? arow.user_id : null;
  const visibility = arow.visibility;
  if (ownerId !== userId && visibility !== "public") {
    let friendIds: string[] = [];
    if (visibility === "friends") {
      try {
        const { data: fsRows } = await service
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
        friendIds = rows.some((r) => areFriends(userId, ownerId ?? "", [r])) ? [ownerId ?? ""] : [];
      } catch {
        return apiError("internal", "好友查詢失敗", 500);
      }
    }
    if (!canViewCheckin(userId, ownerId, visibility, friendIds)) {
      return apiError("forbidden", "無權查看", 403);
    }
  }
  let beerName: string | null = null;
  const beerId = typeof arow.beer_id === "string" ? arow.beer_id : null;
  if (beerId !== null) {
    try {
      const { data: beerRow } = await service.from("beers").select("name").eq("id", beerId).maybeSingle();
      beerName = ((beerRow as { name?: unknown } | null)?.name as string | undefined) ?? null;
    } catch {
      beerName = null;
    }
  }
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const count = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  const avg = num(arow.rating_avg);
  return apiOk({
    checkin: {
      id: arow.id as string,
      photo_url: (arow.photo_url as string | null) ?? null,
      note: (arow.note as string | null) ?? null,
      audio_url: (arow.audio_url as string | null) ?? null,
      audio_seconds: (arow.audio_seconds as number | null) ?? null,
      transcript: (arow.transcript as string | null) ?? null,
      created_at: arow.created_at as string,
      place_name: (arow.place_name as string | null) ?? null,
      lat: (arow.lat as number | null) ?? null,
      lng: (arow.lng as number | null) ?? null,
      beer_name: beerName,
      rating_avg: avg !== null && avg >= 1 && avg <= 5 ? avg : null,
      rating_count: count(arow.rating_count),
      rated_by_me: false,
      my_rating: null,
      is_author: ownerId !== null && ownerId === userId,
      cheers_count: count(arow.cheers_count),
      cheered_by_me: false,
      recent_cheers: [],
      like_count: count(arow.like_count),
      liked_by_me: false,
      saved_by_me: false,
      want_count: count(arow.want_count),
      wanted_by_me: false,
      comment_count: count(arow.comment_count),
      archived: true,
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient();
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  if (typeof id !== "string" || id === "") {
    return apiError("invalid_params", "id 非法", 400);
  }
  let row: Record<string, unknown> | null = null;
  try {
    const { data, error } = await supabase
      .from("checkins")
      .select(DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error(
        `[api/v1/checkins/[id]] read error: code=${error.code} message=${error.message}`,
      );
      return apiError("internal", "打卡讀取失敗", 500);
    }
    row = (data ?? null) as Record<string, unknown> | null;
  } catch (err) {
    return apiError(
      "internal",
      err instanceof Error ? err.message : "unknown",
      500,
    );
  }
  if (row === null) {
    // UR E.22 歸檔回退（舊分享鏈不斷；只讀快照＋archived 旗，互動端點沿舊 404）。
    const archived = await readArchived(supabase, userId, id);
    if (archived !== null) return archived;
    return apiError("not_found", "打卡不存在", 404);
  }
  const ownerId = typeof row.user_id === "string" ? row.user_id : null;
  const visibility = row.visibility;
  let friendIds: string[] = [];
  if (
    ownerId !== null &&
    ownerId !== userId &&
    visibility !== "public"
  ) {
    try {
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
      // 互好友即 ownerId 在可見集（areFriends 雙向 accepted 語義，沿 A.15 D3）。
      friendIds = rows.some((r) => areFriends(userId, ownerId, [r]))
        ? [ownerId]
        : [];
    } catch {
      return apiError("internal", "好友查詢失敗", 500);
    }
  }
  if (!canViewCheckin(userId, ownerId, visibility, friendIds)) {
    return apiError("forbidden", "無權查看", 403);
  }
  // UR E.10 batch4 互动计数＋酒款（加法字段，旧客户端忽略即兼容）。
  // UR E.12 评分明细聚合走 service（路由已过可见门，沿 D.2 口径；只吐聚合＋本人行）。
  const postId = row.id as string;
  const beerId = (row.beer_id as string | null) ?? null;
  const service = await createServiceClient();
  const [{ count: likeCount }, { data: likedRow }, { count: wantCount }, { data: wantedRow }, { count: commentCount }, { data: beerRow }, { data: ratingRows }, { data: savedRow }] =
    await Promise.all([
      supabase.from("post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId),
      supabase.from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
      supabase.from("checkin_wants").select("checkin_id", { count: "exact", head: true }).eq("checkin_id", postId),
      supabase.from("checkin_wants").select("checkin_id").eq("checkin_id", postId).eq("user_id", userId).maybeSingle(),
      supabase.from("checkin_comments").select("id", { count: "exact", head: true }).eq("checkin_id", postId).eq("status", "visible"),
      beerId === null
        ? Promise.resolve({ data: null })
        : supabase.from("beers").select("name").eq("id", beerId).maybeSingle(),
      service.from("checkin_ratings").select("user_id,rating").eq("checkin_id", postId),
      // UR E.26 收藏态（本人行；匿名无此分支，归档分支恒 false）。
      supabase.from("checkin_saves").select("checkin_id").eq("checkin_id", postId).eq("user_id", userId).maybeSingle(),
    ]);
  const clamp = (n: number | null): number =>
    typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const ratingList = ((ratingRows ?? []) as unknown[]).filter(
    (r): r is { user_id: unknown; rating: unknown } =>
      typeof r === "object" && r !== null && "rating" in (r as Record<string, unknown>),
  );
  const { avg: ratingAvg, count: ratingCount } = summarizeRatings(ratingList);
  const mineRating = ratingList.find((r) => r.user_id === userId)?.rating;
  const myRating =
    typeof mineRating === "number" && Number.isInteger(mineRating) ? mineRating : null;
  // UR E.14 乾杯聚合（service 直讀，路由已过可见门）。
  // iOS 碰杯记录区契约（round-4）：recent_cheers 最近 3 个（MailPeer 三列＋时间；隐身者过滤，数量以 count 为准）。
  const { count: cheersCount, data: cheersRows } = await service
    .from("cheers")
    .select("from_user_id,created_at", { count: "exact" })
    .eq("checkin_id", postId)
    .order("created_at", { ascending: false })
    .limit(3);
  type CheersRecent = { user_id: string; nickname: string; avatar_url: string | null; created_at: string };
  let recentCheers: CheersRecent[] = [];
  // cheered_by_me（本帖是否已敬过；路由本就 401 拦匿名，匿名无此分支）。
  const { data: myCheerRow } = await service
    .from("cheers")
    .select("id")
    .eq("checkin_id", postId)
    .eq("from_user_id", userId)
    .limit(1)
    .maybeSingle();
  const cheeredByMe = myCheerRow !== null;
  if (Array.isArray(cheersRows) && cheersRows.length > 0) {
    const fromIds = [...new Set(cheersRows.map((r) => (r as { from_user_id: string }).from_user_id))];
    const { data: cheerUsers } = await service
      .from("users")
      .select("id,nickname,avatar_url,mode")
      .in("id", fromIds);
    const peerMap = new Map(
      (((cheerUsers ?? []) as unknown[]) as { id: string; nickname: string; avatar_url: string | null; mode?: unknown }[]).map(
        (u) => [u.id, u],
      ),
    );
    recentCheers = (cheersRows as { from_user_id: string; created_at: string }[])
      .filter((r) => (peerMap.get(r.from_user_id)?.mode ?? "public") !== "stealth")
      .map((r) => {
        const peer = peerMap.get(r.from_user_id);
        return {
          user_id: r.from_user_id,
          nickname: peer?.nickname ?? "酒友",
          avatar_url: peer?.avatar_url ?? null,
          created_at: r.created_at,
        };
      });
  }
  return apiOk({
    checkin: {
      id: row.id as string,
      photo_url: (row.photo_url as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      audio_url: (row.audio_url as string | null) ?? null,
      audio_seconds: (row.audio_seconds as number | null) ?? null,
      transcript: (row.transcript as string | null) ?? null,
      created_at: row.created_at as string,
      place_name: (row.place_name as string | null) ?? null,
      lat: (row.lat as number | null) ?? null,
      lng: (row.lng as number | null) ?? null,
      beer_name: ((beerRow as { name?: unknown } | null)?.name as string | undefined) ?? null,
      // UR E.12 他人制：只吐平均＋人数＋本人行（旧作者自评 `rating` 已退役，不再吐）。
      rating_avg: ratingAvg,
      rating_count: ratingCount,
      rated_by_me: myRating !== null,
      my_rating: myRating,
      // UR E.14 作者身份服务端说了算（自家帖从地图钉点开会落他人分支，分支 prop 不可信）。
      is_author: ownerId !== null && ownerId === userId,
      // UR E.14 乾杯聚合（iOS round-4：recent_cheers 最近 3＋cheered_by_me；回敬钮仍仅作者，见 Extra）。
      cheers_count: typeof cheersCount === "number" && cheersCount > 0 ? cheersCount : 0,
      cheered_by_me: cheeredByMe,
      recent_cheers: recentCheers,
      like_count: clamp(likeCount),
      liked_by_me: likedRow !== null,
      saved_by_me: savedRow !== null,
      want_count: clamp(wantCount),
      wanted_by_me: wantedRow !== null,
      comment_count: clamp(commentCount),
    },
  });
}

/**
 * UR E.3 删除打卡（DEF-20260929-003：此前只删本地，刷新即被 mine 复活）。
 * `DELETE /api/v1/checkins/:id`（🔒）：只删自己的（`eq user_id`＋RLS owner delete
 * 双保险；非本人／不存在一律 404，不泄露归属）。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient();
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  const parsed = parseCheckinIdParam(id);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  try {
    const { data, error } = await supabase
      .from("checkins")
      .delete()
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .select("id");
    if (error) {
      console.error(
        `[api/v1/checkins/[id]] delete error: code=${error.code} message=${error.message}`,
      );
      return apiError("internal", "打卡删除失败", 500);
    }
    if (!Array.isArray(data) || data.length === 0) {
      return apiError("not_found", "打卡不存在", 404);
    }
  } catch (err) {
    return apiError(
      "internal",
      err instanceof Error ? err.message : "unknown",
      500,
    );
  }
  return apiOk({ deleted: true });
}
