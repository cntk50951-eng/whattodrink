import { apiError } from "@/lib/api/envelope";
import { act, type DiceAction } from "@/lib/barDiceStore";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

import { respond } from "../../_respond";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 叫骰或質疑（🔒）：{type:"bid",qty,face} | {type:"challenge"}。服務端驗證、Ivy 當場回應、整局結束時結算積分。 */
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
  const b = body as { type?: unknown; qty?: unknown; face?: unknown };
  let action: DiceAction;
  if (b.type === "challenge") action = { type: "challenge" };
  else if (b.type === "bid" && Number.isInteger(b.qty) && Number.isInteger(b.face)) action = { type: "bid", qty: b.qty as number, face: b.face as number };
  else return apiError("invalid_params", "type 需為 bid（含 qty、face）或 challenge。", 400);
  return respond(await act(await createServiceClient(), userId, id, action));
}
