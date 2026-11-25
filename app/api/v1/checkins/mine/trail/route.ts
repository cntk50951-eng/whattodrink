import { toMineRow } from "@/lib/api/checkins";
import { apiError, apiOk } from "@/lib/api/envelope";
import { MY_TRAIL_HEADERS, parseMyTrailList, trailBoundsArgs } from "@/lib/api/myTrail";
import { getAuthedClient } from "@/lib/supabase/server";

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401, MY_TRAIL_HEADERS);

  const params = parseMyTrailList(new URL(req.url).searchParams);
  if (params === null) return apiError("invalid_params", "足跡分頁參數無效", 400, MY_TRAIL_HEADERS);

  const { limit, cursor, bounds } = params;
  const { data, error } = await supabase.rpc("my_checkin_trail_page", {
    p_limit: limit,
    p_after_at: cursor?.createdAt ?? null,
    p_after_id: cursor?.id ?? null,
    ...trailBoundsArgs(bounds),
  });
  if (error !== null) {
    if (error.code === "22007" || error.code === "22008" || error.code === "22009") {
      return apiError("invalid_params", "足跡游標無效", 400, MY_TRAIL_HEADERS);
    }
    console.error("[api/v1/checkins/mine/trail] read failed:", error);
    return apiError("internal", "足跡讀取失敗", 500, MY_TRAIL_HEADERS);
  }

  const rows = (data ?? []) as { checkin: unknown; page_cursor: string }[];
  const page = rows.slice(0, limit);
  const checkins = page.flatMap(({ checkin }) => {
    const parsed = toMineRow(checkin);
    return parsed === null ? [] : [parsed];
  });
  const next_cursor = rows.length > limit ? (page.at(-1)?.page_cursor ?? null) : null;
  return apiOk({ checkins, next_cursor }, 200, MY_TRAIL_HEADERS);
}
