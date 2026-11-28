import { toMineRow } from "@/lib/api/checkins";
import { apiError, apiOk } from "@/lib/api/envelope";
import {
  MINE_SHARE_HEADERS,
  blockedLiveFilter,
  cutSharePage,
  isKeyedRow,
  olderThanFilter,
  parseMineShareParams,
  shareSearchFilter,
  shareableExpiryFilter,
} from "@/lib/api/mineShare";
import { getAuthedClient } from "@/lib/supabase/server";

/**
 * UR E.32 `GET /api/v1/checkins/mine/share`（🔒 本人）：聊天「分享打卡」列表。
 * `scope=shareable`（默認）只回可發送的；`scope=blocked` 回私密、已過期與已歸檔的。
 * 新到舊分頁，列表只帶 96px 縮圖（映射到 `photo_url`），不帶原圖與音訊。
 */
const LIVE_COLUMNS =
  "id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,photo_thumb,note,audio_seconds,transcript,tags,hashtags,beers(id,name,emoji,category,tagline,icon_url)";
// 歸檔表零外鍵，不能內嵌 beers（見 ../route.ts），酒款另查
const ARCHIVE_COLUMNS =
  "id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,photo_thumb,note,audio_seconds,transcript,tags";

type Row = { id: string; created_at: string } & Record<string, unknown>;

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401, MINE_SHARE_HEADERS);

  const params = parseMineShareParams(new URL(req.url).searchParams);
  if ("error" in params) return apiError("invalid_params", params.error, 400, MINE_SHARE_HEADERS);
  const { scope, limit, cursor, q } = params;
  const nowIso = new Date().toISOString();

  const fail = (where: string, error: { code?: string; message?: string }) => {
    console.error(`[api/v1/checkins/mine/share] ${where}: code=${error.code ?? ""} message=${error.message ?? ""}`);
    return apiError("internal", "打卡读取失败", 500, MINE_SHARE_HEADERS);
  };

  let search: string | null = null;
  if (q !== null) {
    const { data, error } = await supabase.from("beers").select("id").ilike("name", `%${q}%`).limit(50);
    // 酒款查不到只是少一個匹配條件，店名和留言照常搜
    if (error !== null) console.warn(`[api/v1/checkins/mine/share] beer lookup skipped: code=${error.code}`);
    const beerIds = ((data ?? []) as { id?: unknown }[]).flatMap((b) => (typeof b.id === "string" ? [b.id] : []));
    search = shareSearchFilter(q, beerIds);
  }

  const read = async (table: "checkins" | "checkins_archive") => {
    let query = supabase
      .from(table)
      .select(table === "checkins" ? LIVE_COLUMNS : ARCHIVE_COLUMNS)
      .eq("user_id", userId)
      .eq("type", "want");
    if (table === "checkins") {
      query =
        scope === "shareable"
          ? query.in("visibility", ["public", "friends"]).or(shareableExpiryFilter(nowIso))
          : query.or(blockedLiveFilter(nowIso));
    }
    if (search !== null) query = query.or(search);
    if (cursor !== null) query = query.or(olderThanFilter(cursor));
    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
  };

  const live = await read("checkins");
  if (live.error !== null) return fail("live", live.error);
  const rows: Row[] = ((live.data ?? []) as unknown[]).filter(isKeyedRow);

  const archivedIds = new Set<string>();
  if (scope === "blocked") {
    const archive = await read("checkins_archive");
    // 歸檔表未遷移就只回主表（同 ../route.ts 的退回口徑）
    if (archive.error !== null) {
      console.warn(`[api/v1/checkins/mine/share] archive skipped: code=${archive.error.code}`);
    } else {
      for (const r of ((archive.data ?? []) as unknown[]).filter(isKeyedRow)) {
        archivedIds.add(r.id);
        rows.push({ ...r, kind: r.kind ?? "flash", visibility: r.visibility ?? "private" });
      }
    }
  }

  // 先按原始行切頁（游標不受後面去重影響），再去掉重複的歸檔行
  const { page, nextCursor } = cutSharePage(rows, limit);
  let visible = page;
  const pageArchived = page.filter((r) => archivedIds.has(r.id) && !("beers" in r));
  if (pageArchived.length > 0) {
    // 歸檔邊界上主表仍有同一條：以主表為準（它可能還能分享）
    const dup = await supabase
      .from("checkins")
      .select("id")
      .eq("user_id", userId)
      .in("id", pageArchived.map((r) => r.id));
    if (dup.error !== null) return fail("dedupe", dup.error);
    const stillLive = new Set(((dup.data ?? []) as { id?: unknown }[]).map((r) => r.id));
    visible = page.filter((r) => "beers" in r || !stillLive.has(r.id));

    const beerIds = [...new Set(pageArchived.flatMap((r) => (typeof r.beer_id === "string" ? [r.beer_id] : [])))];
    if (beerIds.length > 0) {
      const { data } = await supabase.from("beers").select("id,name,emoji,category,tagline,icon_url").in("id", beerIds);
      const byId = new Map(((data ?? []) as Record<string, unknown>[]).map((b) => [b.id, b]));
      visible = visible.map((r) => ("beers" in r ? r : { ...r, beers: byId.get(r.beer_id) ?? null }));
    }
  }

  const checkins = visible.flatMap((r) => {
    const parsed = toMineRow(r);
    return parsed === null ? [] : [parsed];
  });
  return apiOk({ checkins, next_cursor: nextCursor }, 200, MINE_SHARE_HEADERS);
}
