import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * UR F.1 地点搜索代理（高德优先，Nominatim 回退）。
 * 前端仅调本站 `/api/v1/places/search?q=中环`，不暴露 Key。
 * - 修复 429 HTML 导致 res.json 抛错 -> text+safeParse
 * - 香港偏置：viewbox + “ 香港”后缀 + 仅留香港结果
 * - 新增：内存 LRU 缓存（60s）+ 请求节流 + 单次为主的回退策略，避免连续 4 次 fetch 打爆限流
 * - 容错：空结果永 200，中英文 + 轻微拼写容忍由 Normalize 辅助
 */

const HK_VIEWBOX = "113.8,22.15,114.5,22.6";
// 简易内存缓存（Serverless 实例常驻时有效，冷启动自动清空）
const CACHE = new Map<string, { ts: number; payload: { places: unknown[] } }>();
const CACHE_TTL = 60_000;
const CACHE_MAX = 120;
let lastFetchAt = 0;

function normalizeQuery(q: string): string {
  // 去多空格、全角转半角、trim；保留中英文，轻度容忍多空格
  return q.replace(/\s+/g, " ").replace(/　/g, " ").trim().slice(0, 40);
}

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  if (text.trimStart().startsWith("<")) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function cacheGet(key: string) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) {
    CACHE.delete(key);
    return null;
  }
  return hit.payload;
}
function cacheSet(key: string, payload: { places: unknown[] }) {
  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value as string | undefined;
    if (first) CACHE.delete(first);
  }
  CACHE.set(key, { ts: Date.now(), payload });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rawQ = url.searchParams.get("q")?.trim() ?? "";
  const q = normalizeQuery(rawQ);
  if (q.length < 1) return apiError("invalid_params", "q 必填", 400);
  if (q.length > 40) return apiError("invalid_params", "关键词过长", 400);

  const cacheKey = q.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) return apiOk(cached);

  const amapKey =
    process.env.AMAP_KEY ??
    process.env.NEXT_PUBLIC_AMAP_KEY ??
    process.env.AMAP_WEB_KEY ??
    process.env.NEXT_PUBLIC_AMAP_WEB_KEY ??
    null;

  // 轻度节流：距上次真实外调 < 400ms 则短暂等待，避免前端抖动打爆 Nominatim
  const now = Date.now();
  const delta = now - lastFetchAt;
  if (delta < 400) await new Promise((r) => setTimeout(r, 400 - delta));

  if (amapKey) {
    try {
      const amapUrl = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(q)}&city=香港&offset=8&page=1&key=${amapKey}&extensions=base`;
      const res = await fetch(amapUrl, { cache: "no-store" });
      lastFetchAt = Date.now();
      const json = await safeJson<{
        status: string;
        pois?: Array<{ id: string; name: string; address: string; location: string; type?: string }>;
      }>(res);
      if (json?.status === "1" && Array.isArray(json.pois) && json.pois.length > 0) {
        const places = json.pois.map((p) => {
          const [lng, lat] = p.location.split(",").map(Number);
          return {
            place_id: p.id,
            display_name: `${p.name} · ${p.address}`,
            name: p.name,
            address: p.address,
            lat: String(lat),
            lon: String(lng),
            category: p.type ?? "",
            source: "amap" as const,
          };
        });
        const payload = { places };
        cacheSet(cacheKey, payload);
        return apiOk(payload);
      }
    } catch (e) {
      console.error("[places/search] amap error", e);
    }
  }

  // Nominatim 回退：精简为 2 档（避免 4 次串行打爆限流）
  const hasHkHint = /香港|Hong Kong|九龙|新界|港岛/i.test(q);
  const qWithHk = hasHkHint ? q : `${q} 香港`;

  type NomItem = { place_id: number; display_name: string; lat: string; lon: string; type?: string; importance?: number };

  async function nomSearch(query: string, extra: string): Promise<NomItem[]> {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(query)}${extra}&addressdetails=1&accept-language=zh&viewbox=${HK_VIEWBOX}&bounded=0&extratags=1`;
    const res = await fetch(nomUrl, {
      headers: { Accept: "application/json", "User-Agent": "whattodrink/1.0 (https://whattodrink.app)" },
      cache: "no-store",
    });
    lastFetchAt = Date.now();
    if (!res.ok) {
      await res.text().catch(() => {});
      return [];
    }
    const json = await safeJson<NomItem[]>(res);
    if (!Array.isArray(json)) return [];
    return json;
  }

  try {
    // 1) qWithHk + hk，2) 若空则 qWithHk 裸查（不再对原 q 单独重试，减少 1/2 外调）
    let raw = await nomSearch(qWithHk, "&countrycodes=hk");
    if (raw.length === 0) raw = await nomSearch(qWithHk, "");

    const hkFiltered = raw.filter((p) => /香港|Hong Kong/.test(p.display_name));
    const use: NomItem[] = hkFiltered.length > 0 ? hkFiltered.slice(0, 8) : raw.length > 0 && hkFiltered.length === 0 ? [] : raw.slice(0, 8);

    const places = use.map((p) => ({
      place_id: String(p.place_id),
      display_name: p.display_name,
      name: p.display_name.split(",")[0] ?? p.display_name,
      address: p.display_name,
      lat: p.lat,
      lon: p.lon,
      category: p.type ?? "",
      source: "nominatim" as const,
    }));
    const payload = { places };
    cacheSet(cacheKey, payload);
    return apiOk(payload);
  } catch (e) {
    console.error("[places/search] nominatim error", e);
    return apiOk({ places: [] });
  }
}
