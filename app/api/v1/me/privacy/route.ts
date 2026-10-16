import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseSavesVisibility, parseVisibility } from "@/lib/api/privacy";
import { parseTrailVisibility } from "@/lib/trailReplay";

/**
 * 私隱設置（🔒，本人；0062）。三項：足跡回放／打卡默認可見性／收藏可見性。
 * `GET` → `{trail_visibility, checkin_visibility, saves_visibility}`
 *   - checkin_visibility：public|friends|private；null＝跟隨賬號模式（隱身仍強制 private）
 *   - 0062 未跑（列不存在）→ 回默认值（off／null／friends），不报错
 * `PATCH {checkin_visibility?: public|friends|private|null, saves_visibility?: public|friends|private}`
 *   - 足跡回放仍走 `PATCH /me/trail`（既有，iOS 已接）。
 *   - checkin_visibility 只影響**新打卡**，不追溯舊帖。
 */
const SELECT_ALL = "trail_visibility,checkin_visibility,saves_visibility";

function shape(r: Record<string, unknown>): Record<string, unknown> {
  return {
    trail_visibility: parseTrailVisibility(r.trail_visibility),
    checkin_visibility: parseVisibility(r.checkin_visibility),
    saves_visibility: parseSavesVisibility(r.saves_visibility),
  };
}

export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const svc = await createServiceClient();
  const { data, error } = await svc.from("users").select(SELECT_ALL).eq("id", userId).maybeSingle();
  if (error !== null) return apiOk(shape({}));
  return apiOk(shape((data ?? {}) as Record<string, unknown>));
}

export async function PATCH(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const update: Record<string, unknown> = {};
  if (body.checkin_visibility !== undefined) {
    if (body.checkin_visibility !== null && parseVisibility(body.checkin_visibility) === null) {
      return apiError("invalid_params", "checkin_visibility 需为 public、friends、private 或 null", 400);
    }
    update.checkin_visibility = body.checkin_visibility;
  }
  if (body.saves_visibility !== undefined) {
    if (parseVisibility(body.saves_visibility) === null) {
      return apiError("invalid_params", "saves_visibility 需为 public、friends 或 private", 400);
    }
    update.saves_visibility = body.saves_visibility;
  }
  if (Object.keys(update).length === 0) {
    return apiError("invalid_params", "至少给 checkin_visibility 或 saves_visibility", 400);
  }
  const svc = await createServiceClient();
  const { error } = await svc.from("users").update(update).eq("id", userId);
  if (error !== null) {
    console.error(`[me/privacy] patch failed: ${error.code} ${error.message}`);
    return apiError("internal", "保存失败", 500);
  }
  const { data } = await svc.from("users").select(SELECT_ALL).eq("id", userId).maybeSingle();
  return apiOk(shape((data ?? {}) as Record<string, unknown>));
}
