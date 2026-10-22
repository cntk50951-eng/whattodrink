import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { restoreAccount } from "@/lib/accountDeletion";

/**
 * UR I.3 恢复账号（🔒）。`POST /api/v1/me/restore`：恢复期（30 天）内回填快照
 * （个人资料＋自己发的内容；好友／聊天／碰杯／酒局不恢复）。
 * 回 `{restored:true, skipped}`（skipped＝插不进的行数，如引用的别人帖子已不存在）；
 * 无申请／已过期／已清除→404；快照损坏→500。
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  try {
    const svc = await createServiceClient();
    const r = await restoreAccount(svc, userId, new Date());
    if (!r.ok) {
      if (r.reason === "not_found") return apiError("not_found", "没有可恢复的账号（未申请或已过期）", 404);
      return apiError("internal", "恢复数据损坏，请联系客服", 500);
    }
    return apiOk({ restored: true, skipped: r.skipped });
  } catch (err) {
    console.error(`[api/v1/me/restore] error: ${err instanceof Error ? err.message : "unknown"}`);
    return apiError("internal", "恢复失败，请稍后重试", 500);
  }
}
