import { apiError } from "@/lib/api/envelope";
import { act, type BjAction } from "@/lib/barBlackjackStore";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

import { respond } from "../../_respond";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 要牌／停牌／加倍（🔒）：{type:"hit"|"stand"|"double"}；Ivy 回合每一步：{type:"ivy_step",said?,lang?}（一次一步，每步一次 AI）。 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return apiError("invalid_params", "match id 不合法。", 400);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "Expected JSON body.", 400);
  }
  const b = body as { type?: unknown; said?: unknown; lang?: unknown };
  let action: BjAction;
  if (b.type === "hit" || b.type === "stand" || b.type === "double") action = { type: b.type };
  else if (b.type === "ivy_step") action = { type: "ivy_step", said: b.said, lang: b.lang };
  else return apiError("invalid_params", "type 需為 hit／stand／double／ivy_step。", 400);
  return respond(await act(await createServiceClient(), userId, id, action));
}
