import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * UR E.14 标已读（🔒）。
 * `PATCH /api/v1/cheers/seen` —— to 我的全标已读（开自己面板即调，fire-and-forget）；
 * 回 `{seen}`（本次标数；RLS to＝自己双保险）。
 */
export async function PATCH(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { data, error } = await supabase
    .from("cheers")
    .update({ seen_at: new Date().toISOString() })
    .eq("to_user_id", userId)
    .is("seen_at", null)
    .select("id");
  if (error !== null) {
    console.error(`[api/v1/cheers/seen] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "标已读失败", 500);
  }
  return apiOk({ seen: Array.isArray(data) ? data.length : 0 });
}
