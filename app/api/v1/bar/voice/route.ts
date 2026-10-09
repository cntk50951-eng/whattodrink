import { apiError } from "@/lib/api/envelope";
import { parseBarLang, type BarLang } from "@/lib/bartender";
import { MinimaxError, minimaxTts } from "@/lib/minimax";
import { ipRateLimit } from "@/lib/rateLimit";

/** lang→TTS boost（yue 用 Chinese,Yue；音色沿用 female-shaonv，粤语自然度待收听验收）。 */
const TTS_BOOST: Record<BarLang, "English" | "Chinese" | "Chinese,Yue"> = {
  en: "English",
  zh: "Chinese",
  yue: "Chinese,Yue",
};

/**
 * POC 酒保语音（公开；输入是上一句台词原文，≤500 字；直接回 MP3 二进制）。
 * UR F.11：lang 可选（缺省按文字自动，非法回落自动）；按 IP 60s 30 次。
 */
export async function POST(req: Request): Promise<Response> {
  let body: { text?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "Expected JSON body.", 400);
  }
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return apiError("invalid_params", "text 不能为空。", 400);
  }
  const text = body.text.trim().slice(0, 500);
  const lang = body.lang === undefined || body.lang === null ? null : parseBarLang(body.lang);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "direct";
  if (!ipRateLimit(`bar-voice:${ip}`, Date.now()).ok) {
    return apiError("rate_limited", "太频了，稍后再试。", 429, { "Retry-After": "60" });
  }

  // 大小写都认（Vercel 里容易顺手写成大写）。
  const apiKey = process.env.minimaxi_api_key ?? process.env.MINIMAXI_API_KEY ?? "";
  if (apiKey.length === 0) {
    console.error("[bar-voice] minimaxi_api_key missing in environment");
    return apiError("internal", "语音服务未配置。", 500);
  }

  try {
    const audio = await minimaxTts(text, {
      apiKey,
      ...(lang === null ? {} : { languageBoost: TTS_BOOST[lang] }),
    });
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
    if (status === 429) {
      return apiError("rate_limited", "语音合成失败。", 429, { "Retry-After": "30" });
    }
    return apiError("internal", "语音合成失败。", 502);
  }
}
