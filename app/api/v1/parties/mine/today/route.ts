import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { hkDayStartISO } from "@/lib/api/party";
import { isTestEndpointsEnabled } from "@/lib/api/testOnly";

/**
 * UR E.25 测试清数（iOS 联调专用；上线前保持 prod 关闭）。
 * `DELETE /api/v1/parties/mine/today` —— 删调用者今天（HK 天窗，与发局 3／天
 * 同一窗口）所有 parties 行；joins 随 FK CASCADE，无需手动清。回 `{deleted: n}`。
 * 门：env 未开即 404（iOS toast“端点未上线”）；匿名 401。
 * 写走 service-role（parties 无 DELETE RLS；服务端 userId 限域，不新开 policy）。
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
  const { count, error } = await supa
    .from("parties")
    .delete({ count: "exact" })
    .eq("host_user_id", userId)
    .gte("created_at", hkDayStartISO(Date.now()));
  if (error !== null) {
    console.error(`[api/v1/parties/mine/today] delete error: code=${error.code} message=${error.message}`);
    return apiError("internal", "清数失败", 500);
  }
  return apiOk({ deleted: count ?? 0 });
}
