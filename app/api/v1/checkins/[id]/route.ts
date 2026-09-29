import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends, type FriendshipRow } from "@/lib/friends";
import { canViewCheckin } from "@/lib/api/checkins";

/**
 * UR E.2 打卡詳情（🔒）。
 * 他人點釘開卡時按需拉三件套（照片＋文字＋語音），pins 列表不帶（weight 考量，
 * 見 UR E.2）：`GET /api/v1/checkins/:id`。
 * 可見門：本人全見／public 全見／friends 僅互好友見，其餘 403（fail-closed）。
 */

const DETAIL_COLUMNS =
  "id,user_id,visibility,photo_url,note,audio_url,audio_seconds,transcript";

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
  return apiOk({
    checkin: {
      id: row.id as string,
      photo_url: (row.photo_url as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      audio_url: (row.audio_url as string | null) ?? null,
      audio_seconds: (row.audio_seconds as number | null) ?? null,
      transcript: (row.transcript as string | null) ?? null,
    },
  });
}
