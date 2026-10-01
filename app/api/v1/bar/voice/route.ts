import { apiError } from "@/lib/api/envelope";
import { MinimaxError, minimaxTts } from "@/lib/minimax";

/**
 * POC 酒保语音（公开；输入是上一句台词原文，≤500 字；直接回 MP3 二进制）。
 */
export async function POST(req: Request): Promise<Response> {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "Expected JSON body.", 400);
  }
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return apiError("invalid_params", "text 不能为空。", 400);
  }
  const text = body.text.trim().slice(0, 500);

  const apiKey = process.env.minimaxi_api_key ?? "";
  if (apiKey.length === 0) {
    return apiError("internal", "语音服务未配置。", 500);
  }

  try {
    const audio = await minimaxTts(text, { apiKey });
    const bytes = new Uint8Array(audio);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const status = e instanceof MinimaxError ? e.status : 500;
    return apiError("internal", "语音合成失败。", status === 429 ? 429 : 502);
  }
}
