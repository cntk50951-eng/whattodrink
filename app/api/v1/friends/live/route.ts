import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { friendIdsOf } from "@/lib/friends";
import { toLiveFriend } from "@/lib/presence";

/**
 * UR A.21 在線好友實時位 `GET /api/v1/friends/live`（🔒）。
 * 隱私三刀全在 server 端（客戶端只渲染，零信任）：
 * 1. 查看者隱身 → 直接 `[]`（不查不報，沿 A.19 全攔口徑）；
 * 2. 只取 accepted 互好友（沿 A.15 D3，`friendIdsOf` 共用）；
 * 3. 對方隱身／超窗／無坐標 → `toLiveFriend` 丟棄。
 * 輪詢 30s 一次（首期；EPIC B 落地切訂閱，shape 不變）。
 */
export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { data: me } = await supabase
    .from("users")
    .select("mode")
    .eq("id", userId)
    .maybeSingle();
  if ((me as { mode?: unknown } | null)?.mode === "stealth") {
    return apiOk({ friends: [] });
  }
  let fsRows: { user_id: unknown; friend_id: unknown; status: unknown }[] = [];
  try {
    const { data } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    fsRows = (data ?? []) as {
      user_id: unknown;
      friend_id: unknown;
      status: unknown;
    }[];
  } catch {
    return apiError("internal", "读取好友失败", 500);
  }
  const ids = friendIdsOf(userId, fsRows);
  if (ids.length === 0) return apiOk({ friends: [] });
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id,nickname,avatar_url,mode,last_seen_at,live_lat,live_lng")
    .in("id", ids);
  if (uErr !== null) {
    return apiError("internal", "读取位置失败", 500);
  }
  const nowMs = Date.now();
  const friends = [];
  for (const row of (users ?? []) as unknown[]) {
    const f = toLiveFriend(
      row as {
        id: unknown;
        nickname: unknown;
        avatar_url: unknown;
        mode: unknown;
        last_seen_at: unknown;
        live_lat: unknown;
        live_lng: unknown;
      },
      nowMs,
    );
    if (f !== null) friends.push(f);
  }
  return apiOk({ friends });
}
