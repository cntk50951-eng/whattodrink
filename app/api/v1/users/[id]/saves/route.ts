import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin, parseMineParams, toMineRow } from "@/lib/api/checkins";
import { parseCheckinIdParam } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";
import { parseSavesVisibility, savesAccess } from "@/lib/api/privacy";

/**
 * 看别人收藏（WEB_HANDOFF_USER_SAVES，iOS 别人主页「收藏」标签）。
 * `GET /api/v1/users/{id}/saves?limit=&cursor=` —— 形状与 `/me/saves` 相同
 * （`{checkins:[...]}`，收藏时间倒序，keyset cursor＝收藏 created_at ISO；
 * 行复用打卡公开列＋`saved_by_me` 为**查看者**是否收藏）。
 * 隐私（web 定）：
 * - 本人随便看；他人默认只限互好友（accepted），陌生人 403（iOS 藏标签）；
 *   0062 `users.saves_visibility`：public＝任何人可看；private＝好友也只得空列表（不暴露设置）；
 *   列未建／读取出错一律当 friends（旧行为）。
 *   拉黑任一方向 404（不泄存在，沿 profile）。
 * - 只回查看者看得到的帖（private／看不到的 friends 帖过滤，删帖消失）；
 *   过滤在 limit 取行后做（与 /me/saves 同口径，页内不足下页补）。
 * 读走 service（读别人收藏行＋跨人可见判，RLS 表述不了）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id: rawId } = await params;
  const parsedId = parseCheckinIdParam(rawId);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  const targetId = parsedId.id;
  const self = targetId === userId;
  const svc = await createServiceClient();
  if (!self) {
    const { data: blockRows } = await svc
      .from("cheers_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`)
      .limit(1);
    if (Array.isArray(blockRows) && blockRows.length > 0) {
      return apiError("not_found", "用户不存在", 404);
    }
    const { data: relRows } = await svc
      .from("friendships")
      .select("user_id,friend_id,status")
      .eq("status", "accepted")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${userId})`,
      )
      .limit(2);
    const isFriend = Array.isArray(relRows) && relRows.length > 0;
    const { data: setRow, error: setErr } = await svc
      .from("users")
      .select("saves_visibility")
      .eq("id", targetId)
      .maybeSingle();
    const setting = parseSavesVisibility(
      setErr === null ? (setRow as { saves_visibility?: unknown } | null)?.saves_visibility : null,
    );
    const access = savesAccess(setting, false, isFriend);
    if (access === "forbidden") {
      return apiError("forbidden", "只限好友查看收藏", 403);
    }
    if (access === "empty") return apiOk({ checkins: [] });
  }
  const q = new URL(req.url).searchParams;
  const parsed = parseMineParams(q);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const cursor = q.get("cursor");
  const cursorMs = cursor !== null ? Date.parse(cursor) : NaN;
  let saveQuery = svc
    .from("checkin_saves")
    .select("checkin_id,created_at")
    .eq("user_id", targetId)
    .order("created_at", { ascending: false })
    .limit(parsed.limit);
  if (Number.isFinite(cursorMs)) {
    saveQuery = saveQuery.lt("created_at", new Date(cursorMs).toISOString());
  }
  const { data: saves, error: sErr } = await saveQuery;
  if (sErr !== null) {
    console.error(`[api/v1/users/saves] saves error: code=${sErr.code} message=${sErr.message}`);
    return apiError("internal", "收藏读取失败", 500);
  }
  const saveRows = ((saves ?? []) as { checkin_id: unknown; created_at: string }[]).filter(
    (s) => typeof s.checkin_id === "string",
  );
  if (saveRows.length === 0) return apiOk({ checkins: [] });
  const postIds = saveRows.map((s) => s.checkin_id as string);
  const [{ data: posts }, { data: fsRows }, { data: mySaves }] = await Promise.all([
    svc.from("checkins").select("id,user_id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,photo_url,note,audio_url,audio_seconds,transcript,beers(id,name,emoji,category,tagline,icon_url)").in("id", postIds),
    svc.from("friendships").select("user_id,friend_id,status").or(`user_id.eq.${userId},friend_id.eq.${userId}`).limit(200),
    svc.from("checkin_saves").select("checkin_id").eq("user_id", userId).in("checkin_id", postIds).limit(postIds.length),
  ]);
  const postById = new Map(
    ((posts ?? []) as Record<string, unknown>[]).map((p) => [p.id as string, p]),
  );
  const friendIds = friendIdsOf(
    userId,
    ((fsRows ?? []) as unknown[]) as { user_id: unknown; friend_id: unknown; status: unknown }[],
  );
  const savedByMe = new Set(
    ((mySaves ?? []) as { checkin_id?: unknown }[])
      .map((s) => s.checkin_id)
      .filter((id): id is string => typeof id === "string"),
  );
  const checkins = [];
  for (const s of saveRows) {
    const post = postById.get(s.checkin_id as string) as
      | { user_id?: unknown; visibility?: unknown }
      | undefined;
    if (post === undefined) continue;
    if (!canViewCheckin(userId, (post.user_id as string | null) ?? null, post.visibility, friendIds)) {
      continue;
    }
    const mapped = toMineRow(postById.get(s.checkin_id as string));
    if (mapped === null) continue;
    checkins.push({ ...mapped, saved_by_me: savedByMe.has(s.checkin_id as string) });
  }
  return apiOk({ checkins });
}
