import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isTestEndpointsEnabled } from "@/lib/api/testOnly";
import { MEET_DAILY_LIMIT } from "@/lib/meet";

/**
 * UR I.1 测试清数（iOS 联调专用；上线前保持 prod 关闭）。
 * `DELETE /api/v1/meet/mine/today` —— 置调用者搜索计数 0（只动自己）；
 * 回 `{reset: true, remaining_today: 10}`。
 * 门：env 未开即 404（iOS toast“测试端点未开”）；匿名 401。
 * 写走 service-role（服务端 userId 限域，不新开 policy）。
 */
export async function DELETE(req: Request): Promise<Response> {
  if (!isTestEndpointsEnabled(process.env.TEST_ENDPOINTS_ENABLED)) {
    return apiError("not_found", "端点未上线", 404);
  }
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const supa = await createServiceClient();
  const { error } = await supa
    .from("users")
    .update({ meet_search_date: null, meet_search_count: 0 })
    .eq("id", userId);
  if (error !== null) {
    console.error(`[api/v1/meet/mine/today] reset error: code=${error.code} message=${error.message}`);
    return apiError("internal", "重置失败", 500);
  }
  return apiOk({ reset: true, remaining_today: MEET_DAILY_LIMIT });
}
