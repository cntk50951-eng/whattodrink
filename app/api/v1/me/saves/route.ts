import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin, parseMineParams, toMineRow } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";

/**
 * UR E.26 我的收藏列表（🔒，匿名 401）。
 * `GET /api/v1/me/saves?limit=&cursor=` —— 只回本人行，收藏时间倒序；
 * limit 沿 /mine（1–50 默认 30），cursor＝收藏 created_at ISO；
 * 行复用打卡公开列（toMineRow）＋`saved_by_me: true` 恒真；
 * 已删帖（inner 对不上）／不可见帖直接跳过（不泄 404 探针）。
 */

// 沿 checkins/mine 同列（打卡公开列；归档不联查，收藏只收现行帖）。
const SAVE_COLUMNS = "id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,photo_url,note,audio_url,audio_seconds,transcript,beers(id,name,emoji,category,tagline,icon_url)";

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const q = new URL(req.url).searchParams;
  const parsed = parseMineParams(q);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const cursor = q.get("cursor");
  const cursorMs = cursor !== null ? Date.parse(cursor) : NaN;

  let saveQuery = supabase
    .from("checkin_saves")
    .select("checkin_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(parsed.limit);
  if (Number.isFinite(cursorMs)) {
    saveQuery = saveQuery.lt("created_at", new Date(cursorMs).toISOString());
  }
  const { data: saves, error: sErr } = await saveQuery;
  if (sErr !== null) {
    console.error(`[api/v1/me/saves] saves error: code=${sErr.code} message=${sErr.message}`);
    return apiError("internal", "收藏读取失败", 500);
  }
  const saveRows = ((saves ?? []) as { checkin_id: unknown; created_at: string }[]).filter(
    (s) => typeof s.checkin_id === "string",
  );
  if (saveRows.length === 0) return apiOk({ checkins: [] });

  const { data: posts } = await supabase
    .from("checkins")
    .select(SAVE_COLUMNS)
    .in("id", saveRows.map((s) => s.checkin_id as string));
  const postById = new Map(
    ((posts ?? []) as Record<string, unknown>[]).map((p) => [p.id as string, p]),
  );
  // friends 可见帖一次取好友（private 他人／陌生 friends 直接 canViewCheckin 挡掉）。
  const { data: fsRows } = await supabase
    .from("friendships")
    .select("user_id,friend_id,status")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .limit(200);
  const friendIds = friendIdsOf(
    userId,
    ((fsRows ?? []) as unknown[]) as { user_id: unknown; friend_id: unknown; status: unknown }[],
  );

  const checkins = [];
  for (const s of saveRows) {
    const post = postById.get(s.checkin_id as string) as
      | { user_id?: unknown; visibility?: unknown }
      | undefined;
    if (post === undefined) continue; // 删帖自动消失
    if (!canViewCheckin(userId, (post.user_id as string | null) ?? null, post.visibility, friendIds)) {
      continue; // 转不可见即消失
    }
    const mapped = toMineRow(postById.get(s.checkin_id as string));
    if (mapped === null) continue;
    checkins.push({ ...mapped, saved_by_me: true });
  }
  return apiOk({ checkins });
}
