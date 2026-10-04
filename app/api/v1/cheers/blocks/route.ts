import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * UR E.15 屏蔽（🔒）。
 * `POST /api/v1/cheers/blocks {blocked_id}` —— upsert 幂等；
 * 双向任一有行，发送侧静默拒（中性文案，不泄谁屏蔽谁）。
 */
export async function POST(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const id = (raw as Record<string, unknown>).blocked_id;
  if (typeof id !== "string" || id === "" || id === userId || id.length > 64) {
    return apiError("invalid_params", "blocked_id 非法", 400);
  }
  const { error } = await supabase
    .from("cheers_blocks")
    .upsert({ blocker_id: userId, blocked_id: id }, { onConflict: "blocker_id,blocked_id" });
  if (error !== null) {
    console.error(`[api/v1/cheers/blocks] upsert error: code=${error.code} message=${error.message}`);
    return apiError("internal", "屏蔽失败", 500);
  }
  return apiOk({ blocked: true });
}
