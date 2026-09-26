import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends, parseFriendCheckParams } from "@/lib/friends";

/**
 * UR A.17 好友模式（第一個端點：關係最小查詢，A.19 引導浮層復用）。
 * UR A.19 加 `checkin_id`：調用方只有 checkin id 時走此參數，server 解作者
 * 再判（行不可見即非好友，fail-closed；零新增公開列）。
 * `GET /api/v1/friends/check?user_id= | ?checkin_id=`（🔒）：回 `{is_friend}`；
 * 任一方向 accepted 即 true（沿 A.15 D3）。RLS 沿 0009 自讀檔。
 */

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const parsed = parseFriendCheckParams(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  let targetUserId: string;
  if ("userId" in parsed.target) {
    targetUserId = parsed.target.userId;
  } else {
    // checkin_id → 解作者；RLS 下不可見（別人的 private 行）即回非好友
    try {
      const { data: row, error: rowErr } = await supabase
        .from("checkins")
        .select("user_id")
        .eq("id", parsed.target.checkinId)
        .maybeSingle();
      if (rowErr || row === null) {
        if (rowErr) {
          console.error(`[api/v1/friends/check] checkin lookup error: code=${rowErr.code} message=${rowErr.message}`);
        }
        return apiOk({ is_friend: false });
      }
      const author = (row as unknown as { user_id: unknown }).user_id;
      if (typeof author !== "string") return apiOk({ is_friend: false });
      targetUserId = author;
    } catch (err) {
      return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
    }
  }
  if (targetUserId === userId) {
    return apiOk({ is_friend: false });
  }
  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .or(`and(user_id.eq.${userId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${userId})`)
      .limit(5);
    if (error) {
      console.error(`[api/v1/friends/check] supabase error: code=${error.code} message=${error.message}`);
      return apiError("internal", "好友查詢失敗", 500);
    }
    const rows = (data ?? []) as { user_id: unknown; friend_id: unknown; status: unknown }[];
    return apiOk({ is_friend: areFriends(userId, targetUserId, rows) });
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
