import { apiError, apiOk } from "@/lib/api/envelope";
import {
  IVY_EVENT_INSTRUCTIONS,
  parseBarLang,
  toMinimaxMessages,
  type IvyHistoryItem,
} from "@/lib/bartender";
import { MinimaxError, minimaxChat } from "@/lib/minimax";
import { ipRateLimit } from "@/lib/rateLimit";

/**
 * POC 酒保对话（公开：bar-room 页本身公开；零写库）。
 * 台词全部来自 MiniMax（M3＋Ivy 人设）；失败回 502，前端显示系统提示。
 * UR F.11：lang 可选（en 缺省／yue／zh，非法回落 en）；按 IP 60s 30 次（防刷额度，
 * 进程级尽力）；上游 429 透传＋Retry-After。
 */
export async function POST(req: Request): Promise<Response> {
  let body: {
    message?: unknown;
    event?: unknown;
    history?: unknown;
    lang?: unknown;
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

  try {
    const text = await minimaxChat(toMinimaxMessages(history, { message, event, lang }), { apiKey });
    return apiOk({ text, lang });
  } catch (e) {
    const status = e instanceof MinimaxError ? e.status : 500;
    console.error(`[bar-chat] minimax failed: ${e instanceof Error ? e.message : e}`);
    if (status === 429) {
      return apiError("rate_limited", "Ivy 暂时没听清，请稍后再试。", 429, { "Retry-After": "30" });
    }
    return apiError("internal", "Ivy 暂时没听清，请稍后再试。", 502);
  }
}
