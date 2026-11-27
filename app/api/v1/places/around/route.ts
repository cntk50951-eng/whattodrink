import { apiError, apiOk } from "@/lib/api/envelope";
import {
  googleNearbySearch,
  isMainlandChina,
  readGoogleServerKey,
} from "@/lib/api/googlePlaces";
import { gcj02ToWgs84 } from "@/lib/geo";

/**
 * UR G.4 附近酒吧／便利店服务端代理（Key 不出服务端）。
 * `GET /api/v1/places/around?lat=&lng=&radius=&kind=` —— kind 只要 bar|store
 * 路由策略：中国大陆境内优先高德；香港与海外优先 Google Places (New)（含 15min 网格缓存＋每日硬上限），
 * 失败或达上限平滑降级高德。所有坐标统一 WGS-84 输出，API 契约完全向下兼容。
 */

export type AroundKind = "bar" | "store";

const KIND_KEYWORDS: Record<AroundKind, string> = {
  bar: "酒吧",
  store: "便利店",
};

type AmapAroundPoi = {
  id: string;
  name: string;
  address: string;
  location: string;
  tel?: unknown;
  distance?: unknown;
};

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text || text.trimStart().startsWith("<")) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function aroundOnce(
  key: string,
  lat: number,
  lng: number,
  radius: number,
  keywords: string,
): Promise<AmapAroundPoi[]> {
  const url =
    `https://restapi.amap.com/v3/place/around?key=${key}` +
    `&location=${lng},${lat}&radius=${radius}&keywords=${encodeURIComponent(keywords)}` +
    `&offset=20&page=1&extensions=base&sortrule=distance`;
  const res = await fetch(url, { cache: "no-store" });
  const json = await safeJson<{ status: string; pois?: AmapAroundPoi[] }>(res);
  if (json?.status !== "1" || !Array.isArray(json.pois)) return [];
  return json.pois;
}

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return apiError("invalid_params", "lat/lng 非法", 400);
  }
  const kindRaw = (q.get("kind") ?? "bar").trim();
  if (kindRaw !== "bar" && kindRaw !== "store") {
    return apiError("invalid_params", "kind 只要 bar|store", 400);
  }
  const kind = kindRaw as AroundKind;
  const radiusRaw = Number(q.get("radius"));
  const radius = Number.isInteger(radiusRaw) && radiusRaw >= 500 && radiusRaw <= 5000 ? radiusRaw : 3000;

  const googleKey = readGoogleServerKey();
  const amapKey =
    process.env.AMAP_KEY ??
    process.env.AMAP_WEB_KEY ??
    process.env.NEXT_PUBLIC_AMAP_KEY ??
    process.env.NEXT_PUBLIC_AMAP_WEB_KEY ??
    null;

  if (!googleKey && (amapKey === null || amapKey === "")) {
    return apiError("internal", "附近搜索未配置（缺 GOOGLE_MAPS_SERVER_KEY / AMAP_KEY）", 503);
  }

  const preferGoogle = googleKey !== null && !isMainlandChina({ lat, lng });

  try {
    if (preferGoogle) {
      let gPlaces = await googleNearbySearch({ key: googleKey, lat, lng, radius, kind });
      if (gPlaces !== null && gPlaces.length === 0 && radius < 5000) {
        gPlaces = await googleNearbySearch({ key: googleKey, lat, lng, radius: 5000, kind });
      }
      if (gPlaces !== null) {
        return apiOk({ places: gPlaces });
      }
    }

    if (amapKey) {
      let pois = await aroundOnce(amapKey, lat, lng, radius, KIND_KEYWORDS[kind]);
      if (pois.length === 0 && radius < 5000) {
        pois = await aroundOnce(amapKey, lat, lng, 5000, KIND_KEYWORDS[kind]);
      }
      const places = [];
      for (const p of pois) {
        if (typeof p.id !== "string" || typeof p.name !== "string") continue;
        const [plng, plat] = String(p.location ?? "").split(",").map(Number);
        if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
        const wgs = gcj02ToWgs84({ lat: plat, lng: plng });
        const dist = typeof p.distance === "string" ? Math.round(Number(p.distance)) : NaN;
        places.push({
          id: p.id,
          name: p.name,
          address: typeof p.address === "string" ? p.address : "",
          tel: typeof p.tel === "string" && p.tel !== "" ? p.tel : null,
          lat: wgs.lat,
          lng: wgs.lng,
          distance_m: Number.isFinite(dist) ? dist : null,
          kind,
        });
      }
      if (places.length > 0 || !googleKey) {
        return apiOk({ places });
      }
    }

    if (googleKey && !preferGoogle) {
      const gPlaces = await googleNearbySearch({ key: googleKey, lat, lng, radius, kind });
      if (gPlaces !== null) return apiOk({ places: gPlaces });
    }

    return apiOk({ places: [] });
  } catch (e) {
    console.error(`[api/v1/places/around] error: ${e instanceof Error ? e.message : "unknown"}`);
    return apiError("internal", "附近搜索失败", 500);
  }
}
