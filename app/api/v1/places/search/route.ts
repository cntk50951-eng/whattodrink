import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * UR F.1 地点搜索代理（高德优先，Nominatim 回退）。
 * 前端仅调本站 `/api/v1/places/search?q=中环`，不暴露 Key。
 * 高德：restapi.amap.com/v3/place/text?keywords=&city=香港&key=KEY
 * Key 取 `AMAP_KEY` / `NEXT_PUBLIC_AMAP_KEY` / `AMAP_WEB_KEY` 任一。
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return apiError("invalid_params", "q 必填", 400);
  if (q.length > 40) return apiError("invalid_params", "关键词过长", 400);

  const amapKey =
    process.env.AMAP_KEY ??
    process.env.NEXT_PUBLIC_AMAP_KEY ??
    process.env.AMAP_WEB_KEY ??
    process.env.NEXT_PUBLIC_AMAP_WEB_KEY ??
    null;

  // 高德优先
  if (amapKey) {
    try {
      const amapUrl = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(q)}&city=香港&offset=8&page=1&key=${amapKey}&extensions=base`;
      const res = await fetch(amapUrl, { cache: "no-store" });
      const json = (await res.json()) as {
        status: string;
        pois?: Array<{
          id: string;
          name: string;
          address: string;
          location: string; // "lng,lat"
          type?: string;
        }>;
      };
      if (json.status === "1" && Array.isArray(json.pois)) {
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
        return apiOk({ places });
      }
    } catch (e) {
      console.error("[places/search] amap error", e);
      // fall through to nominatim
    }
  }

  // 回退 Nominatim
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(q)}&countrycodes=hk&addressdetails=1`;
    const res = await fetch(nomUrl, { headers: { Accept: "application/json", "User-Agent": "whattodrink/1.0" }, cache: "no-store" });
    const json = (await res.json()) as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      type?: string;
    }>;
    const places = (Array.isArray(json) ? json : []).map((p) => ({
      place_id: String(p.place_id),
      display_name: p.display_name,
      name: p.display_name.split(",")[0] ?? p.display_name,
      address: p.display_name,
      lat: p.lat,
      lon: p.lon,
      category: p.type ?? "",
      source: "nominatim" as const,
    }));
    return apiOk({ places });
  } catch (e) {
    return apiError("internal", e instanceof Error ? e.message : "搜索失败", 500);
  }
}
