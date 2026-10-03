import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends, type FriendshipRow } from "@/lib/friends";
import { canViewCheckin, parseCheckinIdParam } from "@/lib/api/checkins";
import { parseRatingBody } from "@/lib/api/rating";

/**
 * UR E.2 打卡詳情（🔒）。
 * 他人點釘開卡時按需拉三件套（照片＋文字＋語音），pins 列表不帶（weight 考量，
 * 見 UR E.2）：`GET /api/v1/checkins/:id`。
 * 可見門：本人全見／public 全見／friends 僅互好友見，其餘 403（fail-closed）。
 */

const DETAIL_COLUMNS =
  "id,user_id,visibility,photo_url,note,audio_url,audio_seconds,transcript,created_at,place_name,lat,lng,beer_id,rating";

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
  if (row === null) return apiError("not_found", "打卡不存在", 404);
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
  const postId = row.id as string;
  const beerId = (row.beer_id as string | null) ?? null;
  const [{ count: likeCount }, { data: likedRow }, { count: wantCount }, { data: wantedRow }, { count: commentCount }, { data: beerRow }] =
    await Promise.all([
      supabase.from("post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId),
      supabase.from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
      supabase.from("checkin_wants").select("checkin_id", { count: "exact", head: true }).eq("checkin_id", postId),
      supabase.from("checkin_wants").select("checkin_id").eq("checkin_id", postId).eq("user_id", userId).maybeSingle(),
      supabase.from("checkin_comments").select("id", { count: "exact", head: true }).eq("checkin_id", postId).eq("status", "visible"),
      beerId === null
        ? Promise.resolve({ data: null })
        : supabase.from("beers").select("name").eq("id", beerId).maybeSingle(),
    ]);
  const clamp = (n: number | null): number =>
    typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const ratingRaw = row.rating as unknown;
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
      rating: typeof ratingRaw === "number" ? ratingRaw : null,
      like_count: clamp(likeCount),
      liked_by_me: likedRow !== null,
      want_count: clamp(wantCount),
      wanted_by_me: wantedRow !== null,
      comment_count: clamp(commentCount),
    },
  });
}

/**
 * UR E.10 batch4 评分设置（🔒，仅作者本人）。
 * `PATCH /api/v1/checkins/:id {rating: 1–5 | null}` —— 本人行才写
 * （`eq user_id`＋RLS owner update 双保险；非本人／不存在一律 404）。
 * 回 `{rating}`（写后值；null 即已清除）。
 */
export async function PATCH(
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
  const { data, error } = await supabase
    .from("checkins")
    .update({ rating: parsed.rating })
    .eq("id", parsedId.id)
    .eq("user_id", userId)
    .select("rating");
  if (error !== null) {
    console.error(`[api/v1/checkins/[id]] rating error: code=${error.code} message=${error.message}`);
    return apiError("internal", "评分保存失败", 500);
  }
  if (!Array.isArray(data) || data.length === 0) {
    return apiError("not_found", "打卡不存在", 404);
  }
  const rating = (data[0] as { rating?: unknown }).rating ?? null;
  return apiOk({ rating: typeof rating === "number" ? rating : null });
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
