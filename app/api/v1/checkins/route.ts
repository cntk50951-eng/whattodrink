import { createClient, getUserId } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCreateCheckinBody } from "@/lib/api/checkins";

/**
 * UR A.10 打卡落库（🔒 需登录，to-do A.4-7 的第一条写）。
 * `POST /api/v1/checkins {beer_id, lat, lng, place_name?}` -> 插 `checkins(type=want, visibility=private)`，owner 归 `auth.uid()`。
 * 前端登录态落 `want` 钉即调此接口（A.11 未登录浮层已拦，匿名不进此口）。
 */

const CHECKIN_SELECT = "id,beer_id,lat,lng,place_name,created_at";

export async function POST(req: Request): Promise<Response> {
  const userId = await getUserId();
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }

  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }

  const parsed = parseCreateCheckinBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { beer_id, lat, lng, place_name } = parsed.body;

  try {
    const supabase = await createClient();

    // 先校验 beer_id 是否存在（FK 不存在会 500，提前转 400 更友好；并发竞态下仍可能落 FK，故容错两路）
    const { data: beerExists, error: beerErr } = await supabase
      .from("beers")
      .select("id")
      .eq("id", beer_id)
      .maybeSingle();
    if (beerErr) {
      console.error(
        `[api/v1/checkins] beer lookup error: code=${beerErr.code} message=${beerErr.message}`,
      );
      return apiError("internal", "beer 校验失败", 500);
    }
    if (beerExists === null) {
      return apiError("invalid_params", `beer_id 不存在：${beer_id}`, 400);
    }

    const { data, error } = await supabase
      .from("checkins")
      .insert({
        user_id: userId,
        beer_id,
        lat,
        lng,
        place_name: place_name ?? null,
        type: "want",
        visibility: "private",
      })
      .select(CHECKIN_SELECT)
      .single();

    if (error || data === null) {
      // FK 违例（并发删酒）也按 400 提示，避免 500 吓到前端
      const isFk = error?.code === "23503";
      if (isFk) {
        return apiError("invalid_params", `beer_id 不存在：${beer_id}`, 400);
      }
      console.error(
        `[api/v1/checkins] insert error: code=${error?.code} message=${error?.message} details=${error?.details ?? ""}`,
      );
      return apiError("internal", "打卡落库失败", 500);
    }

    const row = data as unknown as Record<string, unknown>;
    return apiOk(
      {
        checkin: {
          id: row.id as string,
          beer_id: row.beer_id as string,
          lat: row.lat as number,
          lng: row.lng as number,
          place_name: row.place_name as string | null,
          created_at: row.created_at as string,
        },
      },
      201,
    );
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
