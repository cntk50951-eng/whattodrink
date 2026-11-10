import { apiError } from "@/lib/api/envelope";
import { abandon } from "@/lib/barBlackjackStore";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

import { respond } from "../../_respond";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 離場認輸（算輸一局；今日贏局已滿時不扣）。 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return apiError("invalid_params", "match id 不合法。", 400);
  return respond(await abandon(await createServiceClient(), userId, id));
}
