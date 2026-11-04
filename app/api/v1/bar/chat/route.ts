import { apiError, apiErrorWith, apiOk } from "@/lib/api/envelope";
import { getBarCredits, normalizeRequestId, refundChatCredit, spendChatCredit } from "@/lib/barCredits";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import {
  IVY_EVENT_INSTRUCTIONS,
  parseBarLang,
  toMinimaxMessages,
  type IvyHistoryItem,
} from "@/lib/bartender";
import { sanitizeBarMemory } from "@/lib/barMemory";
import { MinimaxError, minimaxChat } from "@/lib/minimax";
import { ipRateLimit } from "@/lib/rateLimit";

/**
 * 酒保对话（🔒 需登入）：每則 message 扣 1 次聊天額度（今日免費＋大話骰積分，見 lib/barCredits.ts），
 * 額度不夠回 402 credits_exhausted；Ivy 回覆失敗自動退還。event（greet／pat／cheers）不扣次。
 * 原 POC：公开零写库；現在要登入才能用（AI 按 token 計費，額度必須服務端算）。
 * 台词全部来自 MiniMax（M3＋Ivy 人设）；失败回 502，前端显示系统提示。
 * 可选 `memory`（酒保記憶文檔，見 lib/barMemory；清洗後注入 system，不存庫）。
 * UR F.11：lang 可选（en 缺省／yue／zh，非法回落 en）；按 IP 60s 30 次（防刷额度，
 * 进程级尽力）；上游 429 透传＋Retry-After。
 */
export async function POST(req: Request): Promise<Response> {
  let body: {
    message?: unknown;
    event?: unknown;
    history?: unknown;
    lang?: unknown;
    memory?: unknown;
    request_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "Expected JSON body.", 400);
  }

  const history: IvyHistoryItem[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (h): h is { from: string; text: string } =>
            typeof h === "object" &&
            h !== null &&
            ((h as { from?: unknown }).from === "her" ||
              (h as { from?: unknown }).from === "me") &&
            typeof (h as { text?: unknown }).text === "string",
        )
        .map((h) => ({ from: h.from as "her" | "me", text: h.text.slice(0, 500) }))
        .slice(-10)
    : [];

  const event =
    typeof body.event === "string" && body.event in IVY_EVENT_INSTRUCTIONS
      ? (body.event as keyof typeof IVY_EVENT_INSTRUCTIONS)
      : undefined;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
  if (event === undefined && message.length === 0) {
    return apiError("invalid_params", "message 或 event 二选一。", 400);
  }
  const lang = parseBarLang(body.lang);
  // 可選：客戶端帶的酒保記憶（清洗後才注入；壞的當沒有，不影響聊天）
  const memory = body.memory === undefined ? undefined : (sanitizeBarMemory(body.memory) ?? undefined);

  // 需登入；用戶 ID 決定額度歸屬
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "请先登录再和 Ivy 聊天。", 401);

  // UR F.11 按 IP 限频（公开零写库口，额度被刷光全员失声；超限 429＋Retry-After）。
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "direct";
  if (!ipRateLimit(`bar-chat:${ip}`, Date.now()).ok) {
    return apiError("rate_limited", "太频了，稍后再试。", 429, { "Retry-After": "60" });
  }

  // 大小写都认（Vercel 里容易顺手写成大写）。
  const apiKey = process.env.minimaxi_api_key ?? process.env.MINIMAXI_API_KEY ?? "";
  if (apiKey.length === 0) {
    console.error("[bar-chat] minimaxi_api_key missing in environment");
    return apiError("internal", "语音服务未配置。", 500);
  }

  // 只有「用戶說的話」才扣次（event 是客戶端內部觸發，不扣）；先扣後調模型，失敗退還
  const svc = await createServiceClient();
  const requestId = normalizeRequestId(body.request_id);
  let credits: Awaited<ReturnType<typeof spendChatCredit>> | null = null;
  if (message.length > 0) {
    credits = await spendChatCredit(svc, userId, requestId);
    if (credits.kind === "error") return apiError("internal", "額度服務暫時不可用，請稍後再試。", 503);
    if (credits.kind === "exhausted") {
      return apiErrorWith("credits_exhausted", "今日的聊天次數用完了，玩大話骰贏回來吧。", 402, { credits: credits.credits });
    }
  }

  try {
    const text = await minimaxChat(toMinimaxMessages(history, { message, event, lang, memory }), { apiKey });
    const latest = credits?.kind === "ok" ? credits.credits : ((await getBarCredits(svc, userId)) ?? undefined);
    return apiOk({ text, lang, credits: latest });
  } catch (e) {
    if (credits?.kind === "ok" && !credits.duplicate) await refundChatCredit(svc, userId, requestId);
    const status = e instanceof MinimaxError ? e.status : 500;
    console.error(`[bar-chat] minimax failed: ${e instanceof Error ? e.message : e}`);
    if (status === 429) {
      return apiError("rate_limited", "Ivy 暂时没听清，请稍后再试。", 429, { "Retry-After": "30" });
    }
    return apiError("internal", "Ivy 暂时没听清，请稍后再试。", 502);
  }
}
