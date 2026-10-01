import { apiError, apiOk } from "@/lib/api/envelope";
import { IVY_EVENT_INSTRUCTIONS, toMinimaxMessages, type IvyHistoryItem } from "@/lib/bartender";
import { MinimaxError, minimaxChat } from "@/lib/minimax";

/**
 * POC 酒保对话（公开：bar-room 页本身公开；零写库）。
 * 台词全部来自 MiniMax（M3＋Ivy 人设）；失败回 502，前端显示系统提示。
 */
export async function POST(req: Request): Promise<Response> {
  let body: {
    message?: unknown;
    event?: unknown;
    history?: unknown;
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

  const apiKey = process.env.minimaxi_api_key ?? "";
  if (apiKey.length === 0) {
    return apiError("internal", "语音服务未配置。", 500);
  }

  try {
    const text = await minimaxChat(toMinimaxMessages(history, { message, event }), { apiKey });
    return apiOk({ text });
  } catch (e) {
    const status = e instanceof MinimaxError ? e.status : 500;
    return apiError("internal", "Ivy 暂时没听清，请稍后再试。", status === 429 ? 429 : 502);
  }
}
