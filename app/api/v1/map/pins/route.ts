import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parsePinsParams, toPinJson } from "@/lib/api/pins";

/**
 * UR A.8 地图 Pins（A.4-3，🌐 免登入）。
 * 只吐 `visibility=public` 行＋模糊座標（街区 3 位小数，原始值永不外泄）。
 * RLS 复用 0005（checkins/users 公开读），route 自身再加 BBOX 过滤 + 截断。
 * 空 BBOX 结果返回 []，不报错（前端可据此清空地图）。
 */

const PINS_COLUMNS =
  "id,lat,lng,place_name,created_at,users(nickname,avatar_url,gender,last_seen_at),beers(name,emoji)";

export async function GET(req: Request): Promise<Response> {
  const parsed = parsePinsParams(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { bbox, limit } = parsed;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("checkins")
      .select(PINS_COLUMNS)
      .eq("visibility", "public")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", bbox.south)
      .lte("lat", bbox.north)
      .gte("lng", bbox.west)
      .lte("lng", bbox.east)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(
        `[api/v1/map/pins] supabase error: code=${error.code} message=${error.message} details=${error.details ?? ""} hint=${error.hint ?? ""}`,
      );
      return apiError("internal", "pins 讀取失敗", 500);
    }

    const rows = (data ?? []) as unknown[];
    let skipped = 0;
    const pins = [];
    for (const row of rows) {
      const pin = toPinJson(row);
      if (pin === null) {
        skipped += 1;
        continue;
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
