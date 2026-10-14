import { apiError, apiOk } from "@/lib/api/envelope";
import {
  buildMemoryUpdateMessages, emptyBarMemory, isEmptyBarMemory, parseMemoryUpdateReply, parseTranscript, sanitizeBarMemory,
} from "@/lib/barMemory";
import { MinimaxError, minimaxChat } from "@/lib/minimax";
import { ipRateLimit } from "@/lib/rateLimit";

/**
 * 酒保記憶摘要（公開、無狀態、零寫庫——訪客也要用；寫庫由客戶端另走 PUT /me/bar-memory）。
 * `POST /api/v1/bar/memory/update {memory?, transcript[], lang?}` → `{doc, changed}`
 * 把「舊記憶＋本次對話」交模型融合成新文檔；輸出經嚴格清洗（敏感／指令過濾、大小帽）。
 * 模型失敗／輸出無法解析／把舊記憶清空 → 回舊文檔 changed:false（記憶只會變好不會被一次失敗洗掉）。
 * 按 IP 60s 10 次（比 chat 更嚴；這個口一次吃 40 條對話）。
 */
export async function POST(req: Request): Promise<Response> {
  let body: { memory?: unknown; transcript?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "Expected JSON body.", 400);
  }
  const nowIso = new Date().toISOString();
  const old = sanitizeBarMemory(body.memory, nowIso) ?? emptyBarMemory(nowIso);
  const transcript = parseTranscript(body.transcript);
  // 沒有用戶說過話＝沒東西可學
  if (!transcript.some((t) => t.from === "me")) return apiOk({ doc: old, changed: false });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "direct";
  if (!ipRateLimit(`bar-memory:${ip}`, Date.now(), 60_000, 10).ok) {
    return apiError("rate_limited", "太频了，稍后再试。", 429, { "Retry-After": "60" });
  }
  const apiKey = process.env.minimaxi_api_key ?? process.env.MINIMAXI_API_KEY ?? "";
  if (apiKey.length === 0) {
    console.error("[bar-memory] minimaxi_api_key missing in environment");
    return apiError("internal", "記憶服務未配置。", 500);
  }
  try {
    const text = await minimaxChat(buildMemoryUpdateMessages(old, transcript, nowIso), {
      apiKey, maxTokens: 1800, temperature: 0,
    });
    const next = parseMemoryUpdateReply(text, nowIso);
    if (next === null || (isEmptyBarMemory(next) && !isEmptyBarMemory(old))) {
      return apiOk({ doc: old, changed: false });
    }
    return apiOk({ doc: next, changed: true });
  } catch (e) {
    const status = e instanceof MinimaxError ? e.status : 500;
    console.error(`[bar-memory] minimax failed: ${e instanceof Error ? e.message : e}`);
    if (status === 429) return apiError("rate_limited", "暫時整理不了，稍後再試。", 429, { "Retry-After": "30" });
    return apiError("internal", "暫時整理不了，稍後再試。", 502);
  }
}
