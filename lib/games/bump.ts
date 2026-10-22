import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 蓝牙「碰一碰」加入游戏房的凭证（无状态，不落库）。
 * 房主 App 向服务器取一枚凭证，通过 BLE 特征值只给「贴近」的手机读；加入者拿它调 bump-join。
 * 凭证 = `<room_id>.<exp_ms>.<sig>`，sig = base64url(HMAC-SHA256(secret, "<room_id>.<exp_ms>"))。
 * 短寿命（60 秒），房主面板每 30 秒换一枚；不含房间码、不含个人信息。
 */
export const BUMP_TOKEN_TTL_MS = 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string | null {
  const s = process.env.GAME_BUMP_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return s === "" ? null : s;
}

function sign(key: string, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** 发凭证；没有可用密钥回 null（调用方回 503）。key 可注入供单测。 */
export function issueBumpToken(
  roomId: string,
  nowMs: number,
  key: string | null = secret(),
): { token: string; expiresAt: string } | null {
  if (key === null || !UUID_RE.test(roomId)) return null;
  const exp = nowMs + BUMP_TOKEN_TTL_MS;
  const payload = `${roomId}.${exp}`;
  return { token: `${payload}.${sign(key, payload)}`, expiresAt: new Date(exp).toISOString() };
}

export type BumpTokenCheck =
  | { ok: true; roomId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "unavailable" };

export function verifyBumpToken(
  token: string,
  nowMs: number,
  key: string | null = secret(),
): BumpTokenCheck {
  if (key === null) return { ok: false, reason: "unavailable" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [roomId, expRaw, sig] = parts;
  if (!UUID_RE.test(roomId) || !/^\d{10,15}$/.test(expRaw) || sig === "") {
    return { ok: false, reason: "malformed" };
  }
  const want = Buffer.from(sign(key, `${roomId}.${expRaw}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    return { ok: false, reason: "bad_signature" };
  }
  if (Number(expRaw) < nowMs) return { ok: false, reason: "expired" };
  return { ok: true, roomId };
}

export function parseBumpBody(raw: unknown): { token: string } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const t = (raw as { token?: unknown }).token;
  if (typeof t !== "string" || t.length < 40 || t.length > 200) return { error: "token 不合法" };
  return { token: t };
}
