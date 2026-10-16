import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin, parseMineParams, toMineRow } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";

/**
 * UR E.26 我的收藏列表（🔒，匿名 401）。
 * `GET /api/v1/me/saves?limit=&cursor=` —— 只回本人行，收藏时间倒序；
 * limit 沿 /mine（1–50 默认 30），cursor＝收藏 created_at ISO；
 * 行复用打卡公开列（toMineRow）＋`saved_by_me: true` 恒真；
 * 已删帖（inner 对不上）／不可见帖直接跳过（不泄 404 探针）。
 * UR G.9 過期保留：現行帖查不到時回頭查 `checkins_archive`（0056 去 FK 後收藏行保留），
 * 命中且可見即回同列＋`expired: true`（photo／note／audio 置空，位置保留給「帶我去／Pin 住」）。
 */

// 沿 checkins/mine 同列（打卡公开列；归档不联查，收藏只收现行帖）。
// 帶 user_id：可見性判定要用作者 id（以前沒選，owner 恒為 null → 自己的私密／好友可見帖與好友的 friends 帖被誤丟），同時給作者信息 join 用。
const SAVE_COLUMNS = "id,user_id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,photo_url,note,audio_url,audio_seconds,transcript,hashtags,beers(id,name,emoji,category,tagline,icon_url)";

// 歸檔镜像同列（photo／note／audio 讀側置空，只留定位＋店名＋時間給過期行）。
const ARCHIVE_COLUMNS = "id,user_id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at";

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
  // G.9：現行缺席的 id 回頭查歸檔（表未遷移／查錯靜默跳過，不炸整頁）。
  const missingIds = saveRows
    .map((s) => s.checkin_id as string)
    .filter((id) => !postById.has(id));
  const archivedById = new Map<string, Record<string, unknown>>();
  if (missingIds.length > 0) {
    try {
      // 歸檔表 RLS 只 owner 可讀（0026），他人行走 service＋下行 canViewCheckin 代碼門（沿詳情口徑）。
      const svc = await createServiceClient();
      const { data: archived } = await svc.from("checkins_archive").select(ARCHIVE_COLUMNS).in("id", missingIds);
      for (const a of ((archived ?? []) as Record<string, unknown>[])) {
        if (typeof a.id === "string") archivedById.set(a.id, a);
      }
    } catch {
      // 靜默：歸檔表缺席即當無過期行
    }
  }
  for (const s of saveRows) {
    const post = postById.get(s.checkin_id as string) as
      | { user_id?: unknown; visibility?: unknown }
      | undefined;
    if (post === undefined) {
      // 過期歸檔行：同可見門＋位置保留，內容置空＋expired 旗
      const arch = archivedById.get(s.checkin_id as string);
      if (arch === undefined) continue; // 删帖自动消失
      if (!canViewCheckin(userId, (arch.user_id as string | null) ?? null, arch.visibility, friendIds)) {
        continue; // 隱私同口徑：private 他人／陌生 friends 仍不顯示
      }
      const mapped = toMineRow({ ...arch, photo_url: null, note: "", audio_url: null, audio_seconds: null, transcript: null });
      if (mapped === null) continue;
      checkins.push({ ...mapped, saved_by_me: true, expired: true });
      continue;
    }
    if (!canViewCheckin(userId, (post.user_id as string | null) ?? null, post.visibility, friendIds)) {
      continue; // 转不可见即消失
    }
    const mapped = toMineRow(postById.get(s.checkin_id as string));
    if (mapped === null) continue;
    checkins.push({ ...mapped, saved_by_me: true });
  }
  // 作者信息（頭像＋暱稱＋id；收藏／Pin 回顧時看得出是誰的打卡）。只取公開兩列；查不到就缺席，不炸整頁
  const authorIds = new Set<string>();
  for (const s of saveRows) {
    const id = s.checkin_id as string;
    const owner = ((postById.get(id) ?? archivedById.get(id)) as { user_id?: unknown } | undefined)?.user_id;
    if (typeof owner === "string") authorIds.add(owner);
  }
  const authorById = new Map<string, { nickname: string | null; avatar_url: string | null }>();
  if (authorIds.size > 0) {
    try {
      const svc = await createServiceClient();
      const { data: us } = await svc.from("users").select("id,nickname,avatar_url").in("id", [...authorIds]);
      for (const u of ((us ?? []) as Record<string, unknown>[])) {
        if (typeof u.id === "string") {
          authorById.set(u.id, {
            nickname: typeof u.nickname === "string" && u.nickname !== "" ? u.nickname : null,
            avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
          });
        }
      }
    } catch {
      // 靜默：沒有作者信息就當缺席
    }
  }
  const withAuthor = checkins.map((c) => {
    const src = (postById.get(c.id) ?? archivedById.get(c.id)) as { user_id?: unknown } | undefined;
    const owner = typeof src?.user_id === "string" ? src.user_id : null;
    const a = owner === null ? undefined : authorById.get(owner);
    return owner === null ? c : { ...c, author_id: owner, author_nickname: a?.nickname ?? null, author_avatar_url: a?.avatar_url ?? null };
  });
  return apiOk({ checkins: withAuthor });
}
