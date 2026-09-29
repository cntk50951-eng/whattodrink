import { apiError, apiOk } from "@/lib/api/envelope";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return apiError("invalid_params", "lat/lng 必填", 400);

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

  const amapKey =
    process.env.AMAP_KEY ??
    process.env.NEXT_PUBLIC_AMAP_KEY ??
    process.env.AMAP_WEB_KEY ??
    null;

  if (amapKey) {
    try {
      const amapUrl = `https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${amapKey}`;
      const res = await fetch(amapUrl, { cache: "no-store" });
      if (res.ok) {
        const json = await safeJson<{ status: string; regeocode?: { formatted_address: string } }>(res);
        if (json?.status === "1" && json.regeocode?.formatted_address) {
          return apiOk({
            display_name: json.regeocode.formatted_address,
            lat: String(lat),
            lon: String(lng),
            source: "amap" as const,
          });
        }
      } else {
        await res.text().catch(() => {});
      }
    } catch (e) {
      console.error("[places/reverse] amap error", e);
    }
  }

  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=zh&zoom=18`;
    const res = await fetch(nomUrl, {
      headers: { Accept: "application/json", "User-Agent": "whattodrink/1.0 (https://whattodrink.app)" },
      cache: "no-store",
    });
    if (!res.ok) {
      // 429 时 Nominatim 返回 HTML，直接降级为坐标
      await res.text().catch(() => {});
      return apiOk({
        display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat: String(lat),
        lon: String(lng),
        source: "nominatim" as const,
      });
    }
    const json = await safeJson<{ display_name?: string }>(res);
    return apiOk({
      display_name: json?.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat: String(lat),
      lon: String(lng),
      source: "nominatim" as const,
    });
  } catch (e) {
    console.error("[places/reverse] nominatim error", e);
    return apiOk({
      display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat: String(lat),
      lon: String(lng),
      source: "nominatim" as const,
    });
  }
}
