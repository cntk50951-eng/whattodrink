import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { getDeletionRow, isRestorable } from "@/lib/accountDeletion";

/**
 * UR I.3 注销状态（🔒）。`GET /api/v1/me/deletion`：
 * 恢复期内回 `{pending:true, purge_at}`，否则 `{pending:false}`。
 * GET /me 对恢复期账号回 403 account_pending_deletion 后，客户端用它取到期日。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  try {
    const svc = await createServiceClient();
    const row = await getDeletionRow(svc, userId);
    if (row !== null && isRestorable(row, new Date())) {
      return apiOk({ pending: true, purge_at: row.purge_at });
    }
    return apiOk({ pending: false });
  } catch (err) {
    console.error(`[api/v1/me/deletion] error: ${err instanceof Error ? err.message : "unknown"}`);
    return apiError("internal", "读取注销状态失败", 500);
  }
}
