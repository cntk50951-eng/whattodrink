import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends } from "@/lib/friends";
import { buildReplayStops, parseTrailVisibility, TRAIL_WINDOW_MS } from "@/lib/trailReplay";

/**
 * 足跡回放（他人視角，🔒；本人用 App 本地完整數據，這裡對 me 只回設置）。
 * 回 `{state}`：
 *  - hidden：對方沒開放（或 0060 未跑）→ App 不顯示卡
 *  - locked：對方開放給好友，你還不是好友 → 鎖定預告卡，**不給任何點位**
 *  - visible：好友 → `stops`（公開／好友可見、最近 30 天、延遲 24h、坐標模糊約 100 米、無照片／文字／id）
 * 拉黑雙向 404。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const { id } = await params;
  const targetId = id === "me" ? userId : id;
  if (typeof targetId !== "string" || targetId === "" || targetId.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  const svc = await createServiceClient();
  const { data: u, error: uErr } = await svc.from("users").select("trail_visibility").eq("id", targetId).maybeSingle();
  if (uErr !== null || u === null) {
    // 列不存在（0060 未跑）／用戶不存在：一律當沒開放
    return apiOk({ state: "hidden", trail_visibility: "off" });
  }
  const setting = parseTrailVisibility((u as { trail_visibility?: unknown }).trail_visibility);
  if (targetId === userId) return apiOk({ state: "self", trail_visibility: setting });

  const { data: blockRows } = await svc
    .from("cheers_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`)
    .limit(1);
  if (Array.isArray(blockRows) && blockRows.length > 0) return apiError("not_found", "用户不存在", 404);

  if (setting === "off") return apiOk({ state: "hidden" });

  const { data: fs } = await svc
    .from("friendships")
    .select("user_id,friend_id,status")
    .or(`and(user_id.eq.${userId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${userId})`)
    .limit(4);
  if (!areFriends(userId, targetId, ((fs ?? []) as unknown[]) as { user_id: unknown; friend_id: unknown; status: unknown }[])) {
    return apiOk({ state: "locked" });
  }

  const nowMs = Date.now();
  const since = new Date(nowMs - TRAIL_WINDOW_MS).toISOString();
  const cols = "visibility,lat,lng,place_name,created_at,beer_id";
  const [{ data: mainRows }, { data: archRows }] = await Promise.all([
    svc.from("checkins").select(cols).eq("user_id", targetId).in("visibility", ["public", "friends"]).gte("created_at", since).limit(500),
    svc.from("checkins_archive").select(cols).eq("user_id", targetId).in("visibility", ["public", "friends"]).gte("created_at", since).limit(500),
  ]);
  const rows = [...((mainRows ?? []) as unknown[]), ...((archRows ?? []) as unknown[])] as Record<string, unknown>[];
  const beerIds = [...new Set(rows.map((r) => r.beer_id).filter((x): x is string => typeof x === "string" && x !== ""))];
  const emojiByBeer = new Map<string, string>();
  if (beerIds.length > 0) {
    const { data: beers } = await svc.from("beers").select("id,emoji").in("id", beerIds);
    for (const b of ((beers ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof b.id === "string" && typeof b.emoji === "string") emojiByBeer.set(b.id, b.emoji);
    }
  }
  return apiOk({ state: "visible", stops: buildReplayStops(rows, emojiByBeer, nowMs) });
}
