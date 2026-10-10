import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { computeBadge } from "@/lib/push/badge";

/**
 * UR D.9 轻量计数（🔒；iOS 轮询省流：数字变大才拉详情）。
 * `GET /api/v1/me/counters` —— 回五数＋badge（与推送 payload 同口径，沿 computeBadge）。
 * 走 service（game_invites／game_rooms RLS 零 policy，authed 读恒空；
 * 全部查询已按 userId 限域，沿 DEF-20261010-001 判例）。
 * Cache-Control private 10s（浏览器／CDN 短缓；服务端无状态不另存）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  try {
    const svc = await createServiceClient();
    const counts = await computeBadge(svc, userId);
    return apiOk(counts, 200, { "Cache-Control": "private, max-age=10" });
  } catch (e) {
    console.error(`[api/v1/me/counters] error: ${e instanceof Error ? e.message : "unknown"}`);
    return apiError("internal", "计数读取失败", 500);
  }
}
