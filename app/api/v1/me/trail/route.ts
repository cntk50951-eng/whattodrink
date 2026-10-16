import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseTrailVisibility } from "@/lib/trailReplay";

/**
 * 足跡回放公開設置（🔒，本人）。`GET` 讀、`PATCH {trail_visibility:"off"|"friends"|"public"}` 寫（public＝0062）。
 * 0060 沒跑（列不存在）→ GET 回 off；PATCH 回 500（App 顯示保存失敗）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const svc = await createServiceClient();
  const { data, error } = await svc.from("users").select("trail_visibility").eq("id", userId).maybeSingle();
  if (error !== null) return apiOk({ trail_visibility: "off" });
  return apiOk({ trail_visibility: parseTrailVisibility((data as { trail_visibility?: unknown } | null)?.trail_visibility) });
}

export async function PATCH(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let body: { trail_visibility?: unknown };
  try {
    body = (await req.json()) as { trail_visibility?: unknown };
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  if (body.trail_visibility !== "off" && body.trail_visibility !== "friends" && body.trail_visibility !== "public") {
    return apiError("invalid_params", "trail_visibility 需为 off、friends 或 public", 400);
  }
  const svc = await createServiceClient();
  const { error } = await svc.from("users").update({ trail_visibility: body.trail_visibility }).eq("id", userId);
  if (error !== null) {
    console.error(`[me/trail] patch failed: ${error.code} ${error.message}`);
    return apiError("internal", "保存失败", 500);
  }
  return apiOk({ trail_visibility: body.trail_visibility });
}
