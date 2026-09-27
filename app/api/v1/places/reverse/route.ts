import { apiError, apiOk } from "@/lib/api/envelope";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return apiError("invalid_params", "lat/lng 必填", 400);

  const amapKey =
    process.env.AMAP_KEY ??
    process.env.NEXT_PUBLIC_AMAP_KEY ??
    process.env.AMAP_WEB_KEY ??
    null;

  if (amapKey) {
    try {
      const amapUrl = `https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${amapKey}`;
      const res = await fetch(amapUrl, { cache: "no-store" });
      const json = (await res.json()) as { status: string; regeocode?: { formatted_address: string } };
      if (json.status === "1" && json.regeocode?.formatted_address) {
        return apiOk({
          display_name: json.regeocode.formatted_address,
          lat: String(lat),
          lon: String(lng),
          source: "amap" as const,
        });
      }
    } catch (e) {
      console.error("[places/reverse] amap error", e);
    }
  }

  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(nomUrl, { headers: { "User-Agent": "whattodrink/1.0" }, cache: "no-store" });
    const json = (await res.json()) as { display_name?: string };
    return apiOk({
      display_name: json.display_name ?? `${lat},${lng}`,
      lat: String(lat),
      lon: String(lng),
      source: "nominatim" as const,
    });
  } catch (e) {
    return apiError("internal", e instanceof Error ? e.message : "reverse 失败", 500);
  }
}
