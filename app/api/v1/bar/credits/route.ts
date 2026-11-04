import { apiError, apiOk } from "@/lib/api/envelope";
import { getBarCredits } from "@/lib/barCredits";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

/**
 * 酒保聊天額度（🔒）：今日免費＋未過期積分。額度帳本只經 service_role 讀寫（表開 RLS 無 policy）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const svc = await createServiceClient();
  const credits = await getBarCredits(svc, userId);
  if (credits === null) return apiError("internal", "額度服務暫時不可用，請稍後再試。", 503);
  return apiOk(credits);
}
