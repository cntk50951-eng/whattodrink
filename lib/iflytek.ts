import crypto from "node:crypto";

/**
 * UR2.3 iFlytek IAT v2 transcription (server-side only — secrets stay here).
 * Ported from the proven pattern in listentoyourwife/src/iflytek-asr.ts:
 * HMAC-SHA256 authed WebSocket, 16k PCM mono frames, `ws` result parsing.
 *
 * Runs on Node 22 global WebSocket — no extra dependency.
 */

export type IflytekAccent = "cantonese" | "mandarin" | "english";

export interface IflytekCreds {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

const HOST = "iat-api.xfyun.cn";
const PATH = "/v2/iat";

function buildAuthUrl(creds: IflytekCreds): string {
  const dateStr = new Date().toUTCString().replace("UTC", "GMT");
  const requestLine = `GET ${PATH} HTTP/1.1`;
  const signature = crypto
    .createHmac("sha256", creds.apiSecret)
    .update(`host: ${HOST}\ndate: ${dateStr}\n${requestLine}`)
    .digest("base64");
  const authorization = Buffer.from(
    `api_key="${creds.apiKey}", algorithm="hmac-sha256", ` +
      `headers="host date request-line", signature="${signature}"`,
  ).toString("base64");
  const params = new URLSearchParams({
    authorization,
    host: HOST,
    date: dateStr,
  });
  return `wss://${HOST}${PATH}?${params.toString()}`;
}

function businessFor(accent: IflytekAccent): Record<string, string> {
  switch (accent) {
    case "cantonese":
      return { language: "zh_cn", domain: "iat", accent: "cantonese" };
    case "mandarin":
      return { language: "zh_cn", domain: "iat", accent: "mandarin" };
    case "english":
      return { language: "en_us", domain: "iat", accent: "mandarin" };
  }
}

type WsWord = { cw?: { w: string }[] };
type WsSegment = { ws?: WsWord[] };

/** Transcribe 16k PCM mono bytes. Resolves "" when nothing recognised. */
export function transcribePcm16k(
  creds: IflytekCreds,
  pcm: Buffer,
  accent: IflytekAccent,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const business = businessFor(accent);
    const ws = new WebSocket(buildAuthUrl(creds));
    const FRAME = 1280; // 40ms of 16k 16-bit mono
    let offset = 0;
    let first = true;
    let text = "";
    let settled = false;

    const done = (fn: () => void) => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch {
          /* already closed */
        }
        fn();
      }
    };

    const sendFrame = (status: 0 | 1 | 2, audio: Buffer) => {
      const payload: Record<string, unknown> = {
        data: {
          status,
          format: "audio/L16;rate=16000",
          encoding: "raw",
          audio: audio.toString("base64"),
        },
      };
      if (first) {
        first = false;
        payload.common = { app_id: creds.appId };
        payload.business = business;
      }
      ws.send(JSON.stringify(payload));
    };

    const pump = () => {
      if (offset >= pcm.length) {
        sendFrame(2, Buffer.alloc(0));
        return;
      }
      const chunk = pcm.subarray(offset, offset + FRAME);
      offset += chunk.length;
      sendFrame(offset >= pcm.length ? 2 : 1, chunk);
      if (offset < pcm.length) setTimeout(pump, 40);
    };

    ws.addEventListener("open", pump);
    ws.addEventListener("message", (ev) => {
      let msg: {
        code?: number;
        message?: string;
        data?: { status?: number; result?: { ws?: WsSegment[] } };
      };
      try {
        msg = JSON.parse(String((ev as MessageEvent).data));
      } catch (e) {
        done(() => reject(new Error(`ASR parse error: ${(e as Error).message}`)));
        return;
      }
      if (msg.code !== 0) {
        done(() => reject(new Error(`ASR error [${msg.code}]: ${msg.message ?? ""}`)));
        return;
      }
      for (const seg of msg.data?.result?.ws ?? []) {
        for (const w of seg.ws ?? []) {
          text += (w.cw ?? []).map((c) => c.w).join("");
        }
      }
      if (msg.data?.status === 2) done(() => resolve(text));
    });
    ws.addEventListener("close", () => done(() => resolve(text)));
    ws.addEventListener("error", () =>
      done(() => reject(new Error("ASR WebSocket error"))),
    );
    // Safety net: never hang the request longer than 60s.
    setTimeout(() => done(() => resolve(text)), 60_000);
  });
}
