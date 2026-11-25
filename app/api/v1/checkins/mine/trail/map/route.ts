import { toMineRow } from "@/lib/api/checkins";
import { apiError, apiOk } from "@/lib/api/envelope";
import { MY_TRAIL_HEADERS, parseMyTrailMap, trailBoundsArgs } from "@/lib/api/myTrail";
import { getAuthedClient } from "@/lib/supabase/server";

type DbTrailPoint = {
  id: string;
  lat: number;
  lng: number;
  count: number;
  bbox: string | null;
  checkin: unknown;
};

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401, MY_TRAIL_HEADERS);

  const params = parseMyTrailMap(new URL(req.url).searchParams);
  if (params === null) return apiError("invalid_params", "足跡地圖視窗無效", 400, MY_TRAIL_HEADERS);

  const { bounds, zoom } = params;
  const { data, error } = await supabase.rpc("my_checkin_trail_map", {
    ...trailBoundsArgs(bounds),
    p_zoom: zoom,
  });
  if (error !== null) {
    console.error("[api/v1/checkins/mine/trail/map] read failed:", error);
    return apiError("internal", "足跡地圖讀取失敗", 500, MY_TRAIL_HEADERS);
  }

  const points = ((data ?? []) as DbTrailPoint[]).flatMap((row) => {
    const checkin = toMineRow(row.checkin);
    return row.count === 1 && checkin === null ? [] : [{ ...row, checkin }];
  });
  return apiOk({ points }, 200, MY_TRAIL_HEADERS);
}
