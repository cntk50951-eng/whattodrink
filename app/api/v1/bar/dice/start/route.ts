import { apiError } from "@/lib/api/envelope";
import { startMatch } from "@/lib/barDiceStore";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

import { respond } from "../_respond";

/** 開一鋪和 Ivy 的大話骰（🔒；body 可帶 {dice: 3–6}＝每人骰數，默認 5；{zhai: true}＝開齋／飛（簡單版：齋＝1 不當百搭，齋轉飛數量至少 +2）；已有進行中的就接回；大話骰＋21點每日合計最多 25 局）。 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let dice: unknown;
  let zhai: unknown;
  try {
    const b = (await req.json()) as { dice?: unknown; zhai?: unknown };
    dice = b.dice;
    zhai = b.zhai;
  } catch {
    dice = undefined;   // 沒帶 body 也行
  }
  return respond(await startMatch(await createServiceClient(), userId, dice, zhai));
}
