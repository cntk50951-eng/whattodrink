/**
 * MiniMax 直调封装（minimaxi.com 国内平台；key 走 `minimaxi_api_key`）。
 * 文字：MiniMax-M3 chat completions；语音：speech-2.6-turbo TTS（少女音）。
 * 全部可注入 fetch，便于单测；线上失败一律抛 MinimaxError，由路由定状态码。
 */

export const MINIMAX_BASE = "https://api.minimaxi.com";
export const MINIMAX_CHAT_MODEL = "MiniMax-M3";
export const MINIMAX_TTS_MODEL = "speech-2.6-turbo";
export const MINIMAX_TTS_VOICE = "female-shaonv";

export type MinimaxRole = "system" | "user" | "assistant";

export type MinimaxChatMessage = {
  role: MinimaxRole;
  content: string;
};

export class MinimaxError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "MinimaxError";
    this.status = status;
  }
}

type FetchFn = typeof fetch;

function decodeContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((p) => {
        if (typeof p === "object" && p !== null && "text" in p) {
          const t = (p as Record<string, unknown>).text;
          return typeof t === "string" ? t : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

/** 文字对话（非流式；maxTokens 默认 200，酒保短回复够用）。 */
export async function minimaxChat(
  messages: MinimaxChatMessage[],
  opts: { apiKey: string; fetchFn?: FetchFn; maxTokens?: number },
): Promise<string> {
  const doFetch = opts.fetchFn ?? fetch;
  const res = await doFetch(`${MINIMAX_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: MINIMAX_CHAT_MODEL,
      thinking: { type: "disabled" },
      max_completion_tokens: opts.maxTokens ?? 200,
      messages,
    }),
  });
  if (!res.ok) {
    throw new MinimaxError(res.status, `minimax chat ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    base_resp?: { status_code?: number; status_msg?: string };
  };
  if (
    typeof json.base_resp?.status_code === "number" &&
    json.base_resp.status_code !== 0
  ) {
    throw new MinimaxError(502, `minimax chat ${json.base_resp.status_msg ?? "error"}`);
  }
  const text = decodeContent(json.choices?.[0]?.message?.content).trim();
  if (text.length === 0) {
    throw new MinimaxError(502, "minimax chat empty reply");
  }
  return text;
}

/** 文字转语音（MP3 二进制；emotion 快乐＋普通话增强，酒保味）。 */
export async function minimaxTts(
  text: string,
  opts: { apiKey: string; fetchFn?: FetchFn },
): Promise<Buffer> {
  const doFetch = opts.fetchFn ?? fetch;
  const res = await doFetch(`${MINIMAX_BASE}/v1/t2a_v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: MINIMAX_TTS_MODEL,
      text,
      stream: false,
      language_boost: "Chinese",
      output_format: "hex",
      voice_setting: {
        voice_id: MINIMAX_TTS_VOICE,
        speed: 1,
        vol: 1,
        pitch: 0,
        emotion: "happy",
      },
    }),
  });
  if (!res.ok) {
    throw new MinimaxError(res.status, `minimax tts ${res.status}`);
  }
  const json = (await res.json()) as {
    base_resp?: { status_code?: number; status_msg?: string };
    data?: { audio?: unknown; status?: number };
  };
  if (json.base_resp?.status_code !== 0 || typeof json.data?.audio !== "string") {
    throw new MinimaxError(502, `minimax tts ${json.base_resp?.status_msg ?? "error"}`);
  }
  return Buffer.from(json.data.audio, "hex");
}
