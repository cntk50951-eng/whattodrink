import { apiError } from "@/lib/api/envelope";
import { startRound } from "@/lib/barBlackjackStore";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

import { respond } from "../_respond";

/** 開一鋪和 Ivy 的 21點（🔒；已有進行中的就接回；大話骰＋21點每日合計最多 25 局）。我 Blackjack 時開局即結束並結算。 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  return respond(await startRound(await createServiceClient(), userId));
}
