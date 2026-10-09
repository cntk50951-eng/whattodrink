import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { computeBadge } from "@/lib/push/badge";

/**
 * UR D.9 轻量计数（🔒；iOS 轮询省流：数字变大才拉详情）。
 * `GET /api/v1/me/counters` —— 回三数＋badge（与推送 payload 同口径，沿 computeBadge）。
 * Cache-Control private 10s（浏览器／CDN 短缓；服务端无状态不另存）。
 */
export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  try {
    const counts = await computeBadge(supabase, userId);
    return apiOk(counts, 200, { "Cache-Control": "private, max-age=10" });
  } catch (e) {
    console.error(`[api/v1/me/counters] error: ${e instanceof Error ? e.message : "unknown"}`);
    return apiError("internal", "计数读取失败", 500);
  }
}
