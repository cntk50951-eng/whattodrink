/**
 * UR A.21 好友實時追踪 — 心跳解析＋在線好友行解析（純函數，可单测）。
 *
 * 欄位策略：`live_lat／live_lng` 只存最新 fix；鮮度一律沿既有
 * `last_seen_at` 5min 窗（`ONLINE_WINDOW_MS`，沿 UR3.3），不加新時間列——
 * 心跳寫入時三者原子更新（見 `/api/v1/presence`）。
 * 隱私：subject `mode === "stealth"` 的行一律丟棄（server 端過濾，
 * 客戶端只渲染，零信任）。
 */

import { ONLINE_WINDOW_MS } from "./nearby";

/** 心跳位移門：比它小的移動不報（省電＋省寫；A.21 問答定案）。 */
export const HEARTBEAT_MIN_MOVE_M = 50;

export type PresenceBody = {
  lat: number;
  lng: number;
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** `POST /api/v1/presence` body 解析：全球經緯度範圍（旅行也報，不夾香港）。 */
export function parsePresenceBody(
  raw: unknown,
): { body: PresenceBody } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "body 需为对象" };
  }
  const r = raw as Record<string, unknown>;
  const { lat, lng } = r;
  if (!isFiniteNum(lat) || lat < -90 || lat > 90) {
    return { error: "lat 需为 -90~90 有限数" };
  }
  if (!isFiniteNum(lng) || lng < -180 || lng > 180) {
    return { error: "lng 需为 -180~180 有限数" };
  }
  return { body: { lat, lng } };
}

export type LiveFriend = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  lat: number;
  lng: number;
  /** `last_seen_at` epoch ms（鮮度憑證，前端可顯示"n 分鐘前"）。 */
  updated_at: number;
};

/**
 * `GET /friends/live` 回包解析（客戶端用）：server 已過濾，
 * 此處只做形狀校验＋壞條丟棄（零信任 transport）。
 */
export function parseLiveFriendsResponse(raw: unknown): LiveFriend[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as Record<string, unknown>).friends;
  if (!Array.isArray(list)) return [];
  const out: LiveFriend[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.user_id !== "string" || r.user_id.length === 0) continue;
    if (typeof r.nickname !== "string" || r.nickname.length === 0) continue;
    if (r.avatar_url !== null && typeof r.avatar_url !== "string") continue;
    if (typeof r.lat !== "number" || !Number.isFinite(r.lat)) continue;
    if (typeof r.lng !== "number" || !Number.isFinite(r.lng)) continue;
    if (typeof r.updated_at !== "number" || !Number.isFinite(r.updated_at)) continue;
    out.push({
      user_id: r.user_id,
      nickname: r.nickname,
      avatar_url: r.avatar_url,
      lat: r.lat,
      lng: r.lng,
      updated_at: r.updated_at,
    });
  }
  return out;
}

/** 最小 Supabase users 行形狀（join -free，`GET /friends/live` 直查）。 */
export type LiveUserRow = {
  id: unknown;
  nickname: unknown;
  avatar_url: unknown;
  mode: unknown;
  last_seen_at: unknown;
  live_lat: unknown;
  live_lng: unknown;
};

/**
 * 在線好友行解析：以下任一即丟（null）——
 * 非字符串 id／暱稱、隱身、超 5min 窗、無有效 live 坐標。
 * server side `nowMs`，不信客戶端時鐘（沿 pins 口徑）。
 */
export function toLiveFriend(row: LiveUserRow, nowMs: number): LiveFriend | null {
  if (typeof row.id !== "string" || row.id.length === 0) return null;
  if (typeof row.nickname !== "string" || row.nickname.length === 0) return null;
  if (row.mode === "stealth") return null;
  const rawAvatar = row.avatar_url;
  if (rawAvatar !== null && typeof rawAvatar !== "string") return null;
  const seenAt =
    typeof row.last_seen_at === "string" ? Date.parse(row.last_seen_at) : NaN;
  if (!Number.isFinite(seenAt) || nowMs - seenAt > ONLINE_WINDOW_MS) return null;
  if (
    typeof row.live_lat !== "number" ||
    !Number.isFinite(row.live_lat) ||
    typeof row.live_lng !== "number" ||
    !Number.isFinite(row.live_lng)
  ) {
    return null;
  }
  return {
    user_id: row.id,
    nickname: row.nickname,
    avatar_url: rawAvatar,
    lat: row.live_lat,
    lng: row.live_lng,
    updated_at: seenAt,
  };
}
