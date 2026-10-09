/**
 * UR D.9 APNs 通道（Token-based，node:http2；Node runtime 专用，不进 Edge）。
 * JWT（ES256）缓存复用 50 分钟（苹果禁频繁重签，TooManyProviderTokenUpdates）。
 * 无依赖（node:crypto 直签，不引 jose）。
 */

import { createPrivateKey, sign } from "node:crypto";
import { connect, type ClientHttp2Session } from "node:http2";

export type ApnsEnv = "sandbox" | "production";

const HOSTS: Record<ApnsEnv, string> = {
  sandbox: "https://api.sandbox.push.apple.com",
  production: "https://api.push.apple.com",
};

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  /** .p8 内容（PEM 原文或 base64其一，自动识别）。 */
  keyP8: string;
  topic: string;
};

/** 环境变量读配置（缺任一即 null，调用方静默跳过＋warn，不抛）。 */
export function apnsConfigFromEnv(env: Record<string, string | undefined>): ApnsConfig | null {
  const keyId = env.APNS_KEY_ID ?? "";
  const teamId = env.APNS_TEAM_ID ?? "";
  const keyP8 = env.APNS_KEY_P8 ?? "";
  const topic = env.APNS_TOPIC ?? "";
  if (keyId === "" || teamId === "" || keyP8 === "" || topic === "") return null;
  return { keyId, teamId, keyP8, topic };
}

function normalizeP8(keyP8: string): string {
  const t = keyP8.trim();
  if (t.includes("BEGIN PRIVATE KEY")) return t;
  const b64 = t.replace(/\s+/g, "");
  const pem = Buffer.from(b64, "base64").toString("utf8");
  return pem.includes("BEGIN PRIVATE KEY") ? pem : t;
}

let cachedToken: { token: string; exp: number } | null = null;

/** provider token（ES256 JWT；缓存 50 分钟；nowMs 可注入，单测锁复用）。 */
export function apnsProviderToken(cfg: ApnsConfig, nowMs: number = Date.now()): string {
  if (cachedToken !== null && nowMs < cachedToken.exp - 60_000) return cachedToken.token;
  const iat = Math.floor(nowMs / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: cfg.keyId })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: cfg.teamId, iat })).toString("base64url");
  const key = createPrivateKey({ key: normalizeP8(cfg.keyP8), format: "pem" });
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  const token = `${header}.${payload}.${(sig as Buffer).toString("base64url")}`;
  cachedToken = { token, exp: nowMs + 50 * 60_000 };
  return token;
}

/** 测试清 JWT 缓存（生产不用）。 */
export function clearApnsTokenCache(): void {
  cachedToken = null;
}

const sessions = new Map<string, ClientHttp2Session>();

function sessionFor(host: string): ClientHttp2Session {
  const s = sessions.get(host);
  if (s !== undefined && !s.destroyed) return s;
  const next = connect(host);
  sessions.set(host, next);
  return next;
}

export type ApnsResult =
  | { ok: true; apnsId: string | null }
  | { ok: false; status: number; reason: string };

/**
 * 发一条（HTTP/2 POST /3/device/{token}；调用方定重试，本函数单次尽力）。
 * headers 含 collapse-id／push-type／priority／expiration／topic（沿交接 §3.5）。
 */
export async function sendApn(args: {
  cfg: ApnsConfig;
  env: ApnsEnv;
  deviceToken: string;
  topic?: string;
  collapseId: string;
  payload: Record<string, unknown>;
  expirationEpochSec?: number;
  timeoutMs?: number;
}): Promise<ApnsResult> {
  const session = sessionFor(HOSTS[args.env]);
  const token = apnsProviderToken(args.cfg);
  const headers = {
    ":method": "POST",
    ":path": `/3/device/${args.deviceToken}`,
    authorization: `bearer ${token}`,
    "apns-topic": args.topic ?? args.cfg.topic,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "apns-expiration": String(args.expirationEpochSec ?? Math.floor(Date.now() / 1000) + 24 * 3600),
    "apns-collapse-id": args.collapseId,
  };
  const timeoutMs = args.timeoutMs ?? 10_000;
  return await new Promise<ApnsResult>((resolve) => {
    let done = false;
    const finish = (r: ApnsResult): void => {
      if (!done) {
        done = true;
        resolve(r);
      }
    };
    const timer = setTimeout(() => finish({ ok: false, status: 0, reason: "timeout" }), timeoutMs);
    try {
      const stream = session.request(headers);
      stream.setTimeout(timeoutMs, () => {
        stream.close();
        clearTimeout(timer);
        finish({ ok: false, status: 0, reason: "timeout" });
      });
      let status = 0;
      let body = "";
      stream.on("response", (h) => {
        status = typeof h[":status"] === "number" ? h[":status"] : 0;
      });
      stream.on("data", (c) => {
        body += c.toString();
      });
      stream.on("end", () => {
        clearTimeout(timer);
        if (status === 200) {
          finish({ ok: true, apnsId: null });
          return;
        }
        let reason = body.slice(0, 120);
        try {
          const j = JSON.parse(body) as { reason?: unknown };
          if (typeof j.reason === "string") reason = j.reason;
        } catch {}
        finish({ ok: false, status, reason });
      });
      stream.on("error", (e) => {
        clearTimeout(timer);
        finish({ ok: false, status: 0, reason: e.message.slice(0, 120) });
      });
      stream.end(JSON.stringify(args.payload));
    } catch (e) {
      clearTimeout(timer);
      finish({ ok: false, status: 0, reason: e instanceof Error ? e.message.slice(0, 120) : "unknown" });
    }
  });
}
