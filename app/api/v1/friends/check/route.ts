import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends, parseCheckUserId } from "@/lib/friends";

/**
 * UR A.17 好友模式（第一個端點：關係最小查詢，A.19 引導浮層復用）。
 * `GET /api/v1/friends/check?user_id=`（🔒）：回 `{is_friend}`；
 * 任一方向 accepted 即 true（沿 A.15 D3）。RLS 沿 0009 自讀檔。
 */

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const parsed = parseCheckUserId(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const target = parsed.userId;
  if (target === userId) {
    return apiOk({ is_friend: false });
  }
  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .or(`and(user_id.eq.${userId},friend_id.eq.${target}),and(user_id.eq.${target},friend_id.eq.${userId})`)
      .limit(5);
    if (error) {
      console.error(`[api/v1/friends/check] supabase error: code=${error.code} message=${error.message}`);
      return apiError("internal", "好友查詢失敗", 500);
    }
    const rows = (data ?? []) as { user_id: unknown; friend_id: unknown; status: unknown }[];
    return apiOk({ is_friend: areFriends(userId, target, rows) });
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
