import { createClient, getAuthedClient, getUserId } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { PINS_RANGE_MS, parsePinsParams, toPinJson } from "@/lib/api/pins";
import type { BBox } from "@/lib/api/pins";
import { friendIdsOf, hideOnlineForViewer } from "@/lib/friends";

/**
 * UR A.8 地图 Pins（A.4-3，🌐 免登入）+ UR A.13 時間窗口 + UR A.17 只看好友。
 * 預設（scope=all）只吐 `visibility=public` 行＋模糊座標（街区 3 位小数，原始值永不外泄）。
 * `scope=friends`（🔒）：回 accepted 好友的 friends＋public 行（同itest時效＋模糊）。
 * 綠點關係過濾（A.15 D4）：friends 模式作者對非好友 `isOnline=false`。
 * 時間判定一律 server side（`now`），不信客戶端時鐘：
 *   flash: `expires_at > now`（24h 固定過期）
 *   post : `created_at >= now - range`（7d 預設 / 90d 擴展）
 * RLS：公開讀沿 0005，friends 行讀沿 0009（route 自身再加 BBOX + 時效謂詞）。
 * 空 BBOX 结果返回 []，不报错（前端可据此清空地图）。
 */

const PINS_COLUMNS =
  "id,lat,lng,place_name,created_at,kind,expires_at,user_id,users!checkins_user_id_fkey(nickname,avatar_url,gender,last_seen_at,mode),beers(name,emoji)";

export async function GET(req: Request): Promise<Response> {
  const parsed = parsePinsParams(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { bbox, limit, range, scope } = parsed;

  // server side now，不信客戶端時鐘（你已確認）— 雙查合併避免 PostgREST or 含 ISO 的解析歧義
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const cutoffIso = new Date(nowMs - PINS_RANGE_MS[range]).toISOString();

  // UR A.17 只看好友：需登入（匿名＋scope 即 401，不走到查詢）
  if (scope === "friends") {
    const { supabase, userId } = await getAuthedClient(req);
    if (userId === null) {
      return apiError("unauthorized", "未登录", 401);
    }
    return friendsScopePins(supabase, userId, bbox, limit, nowIso, cutoffIso);
  }

  try {
    const supabase = await createClient();
    // 綠點關係過濾只看「作者 mode」：viewer 身份順手取（匿名回 null，不擋公開讀）
    const viewerId = await getUserId();

    // 並行雙查：flash 24h 內 + post 在 range 內，合併後按 created_at 倒序截斷
    const [flashRes, postRes] = await Promise.all([
      supabase
        .from("checkins")
        .select(PINS_COLUMNS)
        .eq("visibility", "public")
        .eq("kind", "flash")
        .gt("expires_at", nowIso)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", bbox.south)
        .lte("lat", bbox.north)
        .gte("lng", bbox.west)
        .lte("lng", bbox.east)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("checkins")
        .select(PINS_COLUMNS)
        .eq("visibility", "public")
        .eq("kind", "post")
        .gte("created_at", cutoffIso)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", bbox.south)
        .lte("lat", bbox.north)
        .gte("lng", bbox.west)
        .lte("lng", bbox.east)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    // 任一查 42703 即視為未遷移（0007 未執行），回退為 bbox-only 單查
    const flashErr = flashRes.error;
    const postErr = postRes.error;
    if (flashErr !== null || postErr !== null) {
      const msg = `${flashErr?.message ?? ""} ${flashErr?.details ?? ""} ${postErr?.message ?? ""} ${postErr?.details ?? ""}`.toLowerCase();
      const isMissing =
        flashErr?.code === "42703" ||
        postErr?.code === "42703" ||
        msg.includes("kind") ||
        msg.includes("expires_at") ||
        msg.includes("column") ||
        msg.includes("does not exist");
      if (isMissing) {
        const firstErr = flashErr ?? postErr;
        console.warn(`[api/v1/map/pins] kind column missing (code=${firstErr?.code}), fallback to bbox-only: ${firstErr?.message}`);
        const { data: fbData, error: fbError } = await supabase
          .from("checkins")
          .select("id,lat,lng,place_name,created_at,users!checkins_user_id_fkey(nickname,avatar_url,gender,last_seen_at),beers(name,emoji)")
          .eq("visibility", "public")
          .not("lat", "is", null)
          .not("lng", "is", null)
          .gte("lat", bbox.south)
          .lte("lat", bbox.north)
          .gte("lng", bbox.west)
          .lte("lng", bbox.east)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (fbError) {
          console.error(`[api/v1/map/pins] fallback error: code=${fbError.code} message=${fbError.message} details=${(fbError as unknown as {details?:string})?.details ?? ""}`);
          return apiError("internal", `pins 讀取失敗(fallback): ${fbError.code} ${fbError.message} ${(fbError as unknown as {details?:string})?.details ?? ""}`.trim(), 500);
        }
        const rows = (fbData ?? []) as unknown[];
        const pins = rows.map((r) => toPinJson(r)).filter((p): p is NonNullable<typeof p> => p !== null);
        return apiOk({ pins });
      }
      const err = flashErr ?? postErr;
      console.error(`[api/v1/map/pins] supabase error: code=${err?.code} message=${err?.message} details=${(err as unknown as {details?:string})?.details ?? ""} hint=${(err as unknown as {hint?:string})?.hint ?? ""}`);
      // 開發態透出真因，便於你 curl 直接看到（上線前改回通用文案）
      return apiError("internal", `pins 讀取失敗: ${err?.code ?? "unknown"} ${err?.message ?? ""} ${(err as unknown as {details?:string})?.details ?? ""}`.trim(), 500);
    }

    const merged = [...((flashRes.data ?? []) as unknown[]), ...((postRes.data ?? []) as unknown[])];
    // 按 created_at 倒序，截 limit（兩流各 limit，合併後再截）
    merged.sort((a, b) => {
      const ca = (a as Record<string, unknown>).created_at as string;
      const cb = (b as Record<string, unknown>).created_at as string;
      return cb.localeCompare(ca);
    });
    const sliced = merged.slice(0, limit);
    const rows: unknown[] = sliced;
    // UR A.17 綠點關係過濾：先看有無 friends 模式作者，有＋viewer 已登入才拉關係（省一次查詢）
    let viewerFriendIds: string[] = [];
    if (
      viewerId !== null &&
      sliced.some((r) => {
        if (typeof r !== "object" || r === null) return false;
        const u = (r as Record<string, unknown>).users;
        return (
          typeof u === "object" && u !== null && (u as Record<string, unknown>).mode === "friends"
        );
      })
    ) {
      try {
        const { data: fsRows } = await supabase
          .from("friendships")
          .select("user_id,friend_id,status")
          .eq("status", "accepted")
          .or(`user_id.eq.${viewerId},friend_id.eq.${viewerId}`);
        viewerFriendIds = friendIdsOf(
          viewerId,
          (fsRows ?? []) as { user_id: unknown; friend_id: unknown; status: unknown }[],
        );
      } catch {}
    }
    let skipped = 0;
    const pins = [];
    for (const row of rows) {
      const pin = toPinJson(row);
      if (pin === null) {
        skipped += 1;
        continue;
      }
      // UR A.17：friends 模式作者對非好友藏綠點（坐标／内容照出，只動 isOnline）
      if (typeof row === "object" && row !== null) {
        const r = row as Record<string, unknown>;
        const authorId = typeof r.user_id === "string" ? r.user_id : null;
        const u = r.users;
        const authorMode =
          typeof u === "object" && u !== null && typeof (u as Record<string, unknown>).mode === "string"
            ? ((u as Record<string, unknown>).mode as string)
            : null;
        if (hideOnlineForViewer(authorMode, authorId, viewerId, viewerFriendIds)) {
          pin.isOnline = false;
        }
      }
      // 二次校验：模糊后仍需落在 BBOX 内？不需要——模糊是截断（偏西南），可能略出 BBOX，
      // 但前端会按 BBOX 渲染，轻微出界不影响街区级展示，故不二次过滤。
      pins.push(pin);
    }
    if (skipped > 0) {
      console.warn(`[api/v1/map/pins] skipped ${skipped} malformed rows`);
    }

    return apiOk({ pins });
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}

/**
 * UR A.17 只看好友：accepted 好友的 friends＋public 行（同時效＋模糊＋BBOX）。
 * RLS 靠 0009（friends 行）＋0005（public 行）＋0006（自己行），三檔 OR。
 * 好友全是 accepted，綠點照 `isOnline` 原樣出，不另過濾。
 */
async function friendsScopePins(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
  bbox: BBox,
  limit: number,
  nowIso: string,
  cutoffIso: string,
): Promise<Response> {
  try {
    const { data: fsRows, error: fsErr } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (fsErr) {
      console.error(`[api/v1/map/pins] friendships error: code=${fsErr.code} message=${fsErr.message}`);
      return apiError("internal", "好友查詢失敗", 500);
    }
    const friendIds = friendIdsOf(
      userId,
      (fsRows ?? []) as { user_id: unknown; friend_id: unknown; status: unknown }[],
    );
    // 無好友即空牆：不下 `.in([])`（PostgREST 空集語義不定），直接回 []
    if (friendIds.length === 0) {
      return apiOk({ pins: [] });
    }
    const vis = ["friends", "public"];
    const [flashRes, postRes] = await Promise.all([
      supabase
        .from("checkins")
        .select(PINS_COLUMNS)
        .in("visibility", vis)
        .in("user_id", friendIds)
        .eq("kind", "flash")
        .gt("expires_at", nowIso)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", bbox.south)
        .lte("lat", bbox.north)
        .gte("lng", bbox.west)
        .lte("lng", bbox.east)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("checkins")
        .select(PINS_COLUMNS)
        .in("visibility", vis)
        .in("user_id", friendIds)
        .eq("kind", "post")
        .gte("created_at", cutoffIso)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", bbox.south)
        .lte("lat", bbox.north)
        .gte("lng", bbox.west)
        .lte("lng", bbox.east)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);
    const err = flashRes.error ?? postRes.error;
    if (err) {
      console.error(`[api/v1/map/pins] friends scope error: code=${err.code} message=${err.message}`);
      return apiError("internal", "好友 pins 讀取失敗", 500);
    }
    const merged = [...((flashRes.data ?? []) as unknown[]), ...((postRes.data ?? []) as unknown[])];
    merged.sort((a, b) => {
      const ca = (a as Record<string, unknown>).created_at as string;
      const cb = (b as Record<string, unknown>).created_at as string;
      return cb.localeCompare(ca);
    });
    const pins = [];
    for (const row of merged.slice(0, limit)) {
      const pin = toPinJson(row);
      if (pin !== null) pins.push(pin);
    }
    return apiOk({ pins });
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
