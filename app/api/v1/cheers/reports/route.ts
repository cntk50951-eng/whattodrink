import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * UR E.15 举报（🔒）。
 * `POST /api/v1/cheers/reports {target_user_id, reason?}` —— 只存，审核队列另议；
 * reason 限 200 字，空即无理由。
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
  const r = raw as Record<string, unknown>;
  const target = r.target_user_id;
  if (typeof target !== "string" || target === "" || target === userId || target.length > 64) {
    return apiError("invalid_params", "target_user_id 非法", 400);
  }
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 200) : "";
  const { error } = await supabase.from("cheers_reports").insert({
    reporter_id: userId,
    target_user_id: target,
    reason,
  });
  if (error !== null) {
    console.error(`[api/v1/cheers/reports] insert error: code=${error.code} message=${error.message}`);
    return apiError("internal", "举报失败", 500);
  }
  return apiOk({ reported: true });
}
