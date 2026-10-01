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

  // 大小写都认（Vercel 里容易顺手写成大写）。
  const apiKey = process.env.minimaxi_api_key ?? process.env.MINIMAXI_API_KEY ?? "";
  if (apiKey.length === 0) {
    console.error("[bar-voice] minimaxi_api_key missing in environment");
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
    console.error(`[bar-voice] minimax failed: ${e instanceof Error ? e.message : e}`);
    return apiError("internal", "语音合成失败。", status === 429 ? 429 : 502);
  }
}
