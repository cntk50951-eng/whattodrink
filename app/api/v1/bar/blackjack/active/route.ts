import { apiError, apiOk } from "@/lib/api/envelope";
import { getActive } from "@/lib/barBlackjackStore";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

/** 接回進行中的一局（沒有回 {view:null}）。 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  return apiOk({ view: await getActive(await createServiceClient(), userId) });
}
