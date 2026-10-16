import { createClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { toPinJson } from "@/lib/api/pins";
import { haversineMeters } from "@/lib/geo";
import { groupOfKey } from "@/lib/api/taste";
import { normalizeHashtag } from "@/lib/hashtags";

/**
 * 遇見智能搜索·帖子（🔒）：`POST {tags?, hashtags?, keywords?, lat?, lng?, radius_m?, within_hours?}`
 * → `{posts:[PinJson＋tags＋hashtags＋distance_m?]}`。只查 visibility=public、時效內的行（同地圖釘口徑：街區級模糊座標、
 * 縮圖、作者公開欄位），不回原圖／語音。文字條件（酒類／#標籤／關鍵詞）任一命中即入選；給了座標則按半徑過濾並按距離排。最多 20 條。
 */
const COLUMNS =
  "id,lat,lng,place_name,created_at,kind,expires_at,user_id,photo_thumb,note,tags,hashtags,users!checkins_user_id_fkey(nickname,avatar_url,gender,dob,bio,last_seen_at,mode),beers(name,emoji)";

const KW_RE = /^[\p{L}\p{N}_\-·]+$/u;

export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const b = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const tags = (Array.isArray(b.tags) ? b.tags : []).filter((k): k is string => typeof k === "string" && groupOfKey(k) !== null).slice(0, 5);
  const hashtags: string[] = [];
  for (const h of Array.isArray(b.hashtags) ? b.hashtags : []) {
    const n = typeof h === "string" ? normalizeHashtag(h) : null;
    if (n !== null && !hashtags.includes(n)) hashtags.push(n);
    if (hashtags.length === 5) break;
  }
  const keywords = (Array.isArray(b.keywords) ? b.keywords : [])
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.normalize("NFKC").trim())
    .filter((k) => k !== "" && [...k].length <= 12 && KW_RE.test(k))
    .slice(0, 3);
  const lat = typeof b.lat === "number" && Number.isFinite(b.lat) && Math.abs(b.lat) <= 90 ? b.lat : null;
  const lng = typeof b.lng === "number" && Number.isFinite(b.lng) && Math.abs(b.lng) <= 180 ? b.lng : null;
  const geo = lat !== null && lng !== null;
  const radius = typeof b.radius_m === "number" && Number.isFinite(b.radius_m) ? Math.min(30_000, Math.max(200, Math.floor(b.radius_m))) : 5000;
  const hours = typeof b.within_hours === "number" && Number.isFinite(b.within_hours) ? Math.min(720, Math.max(1, Math.floor(b.within_hours))) : 168;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const cutoffIso = new Date(nowMs - hours * 3600_000).toISOString();
  const supabase = await createClient();

  // 文字條件（任一命中）：酒類 tags／#標籤 hashtags／關鍵詞（地點名或文字）
  const ors: string[] = [];
  if (tags.length > 0) ors.push(`tags.ov.{${tags.join(",")}}`);
  if (hashtags.length > 0) ors.push(`hashtags.ov.{${hashtags.map((h) => `"${h}"`).join(",")}}`);
  for (const k of keywords) ors.push(`place_name.ilike.*${k}*`, `note.ilike.*${k}*`);

  const build = (kind: "flash" | "post") => {
    let q = supabase.from("checkins").select(COLUMNS).eq("visibility", "public").eq("kind", kind).gte("created_at", cutoffIso);
    q = kind === "flash" ? q.gt("expires_at", nowIso) : q;
    q = q.not("lat", "is", null).not("lng", "is", null);
    if (geo) {
      const dLat = radius / 111_000;
      const dLng = radius / (111_000 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
      q = q.gte("lat", lat - dLat).lte("lat", lat + dLat).gte("lng", lng - dLng).lte("lng", lng + dLng);
    }
    if (ors.length > 0) q = q.or(ors.join(","));
    return q.order("created_at", { ascending: false }).limit(60);
  };
  const [flash, post] = await Promise.all([build("flash"), build("post")]);
  if (flash.error !== null && post.error !== null) {
    console.error(`[search/posts] error: ${flash.error.code} ${flash.error.message}`);
    return apiError("internal", "搜尋失敗", 500);
  }
  const rows = [...((flash.data ?? []) as unknown[]), ...((post.data ?? []) as unknown[])] as Record<string, unknown>[];
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const pin = toPinJson(r, nowMs);
    if (pin === null) continue;
    let dist: number | null = null;
    if (geo && typeof r.lat === "number" && typeof r.lng === "number") {
      dist = Math.round(haversineMeters({ lat, lng }, { lat: r.lat, lng: r.lng }));
      if (dist > radius) continue;
    }
    out.push({
      ...pin,
      tags: Array.isArray(r.tags) ? (r.tags as unknown[]).filter((x): x is string => typeof x === "string") : [],
      hashtags: Array.isArray(r.hashtags) ? (r.hashtags as unknown[]).filter((x): x is string => typeof x === "string") : [],
      ...(dist !== null ? { distance_m: dist } : {}),
    });
  }
  out.sort((x, y) =>
    geo ? ((x.distance_m as number) ?? 0) - ((y.distance_m as number) ?? 0) : (y.checkedInAt as number) - (x.checkedInAt as number),
  );
  return apiOk({ posts: out.slice(0, 20) });
}
