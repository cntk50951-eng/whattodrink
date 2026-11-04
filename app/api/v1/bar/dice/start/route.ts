import { apiError } from "@/lib/api/envelope";
import { startMatch } from "@/lib/barDiceStore";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

import { respond } from "../_respond";

/** 開一局和 Ivy 的大話骰（🔒；已有進行中的就接回；每日最多 20 局）。 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  return respond(await startMatch(await createServiceClient(), userId));
}
