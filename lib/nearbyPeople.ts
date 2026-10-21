/**
 * 附近的人（`GET /api/v1/nearby/people`）— 純函數，可單測。
 *
 * 規則：
 * - 在線＝心跳 5 分鐘窗內（沿 UR3.3 `ONLINE_WINDOW_MS`）；隱身、未成年、無有效坐標、無暱稱一律丟棄。
 * - 對陌生人**不回精確距離與坐標**，只回「距離檔」（向上取整到固定檔位），防止被三角定位。
 * - 排序：本次上線時間（`online_since`，沒有就用 `last_seen_at`）新→舊，再按精確距離近→遠（精確值只在 server 內部用）。
 */

import { ONLINE_WINDOW_MS } from "./nearby";
import { haversineMeters } from "./geo";
import type { LatLng } from "./geo";
import { isMinorDob } from "./api/cheers";
import { groupOfKey } from "./api/taste";

export const NEARBY_PEOPLE_DEFAULT_KM = 3;
export const NEARBY_PEOPLE_MAX_KM = 10;
export const NEARBY_PEOPLE_LIMIT = 50;
/** 距離檔（米）：回包只給這些值之一（向上取整）。 */
export const DISTANCE_BANDS_M = [200, 500, 1000, 2000, 3000, 5000, 10000] as const;

export function distanceBand(meters: number): number {
  const m = Number.isFinite(meters) && meters > 0 ? meters : 0;
  for (const b of DISTANCE_BANDS_M) if (m <= b) return b;
  return DISTANCE_BANDS_M[DISTANCE_BANDS_M.length - 1];
}

/**
 * 心跳時決定 `online_since`：上一次心跳在窗內＝同一次上線（沿用舊值，缺失用上次心跳時間）；
 * 否則（從沒上報／已斷開超過窗）＝重新上線，重置為現在。
 */
export function nextOnlineSince(
  prevLastSeen: unknown,
  prevOnlineSince: unknown,
  nowMs: number,
): string {
  const last = typeof prevLastSeen === "string" ? Date.parse(prevLastSeen) : NaN;
  const continuing = Number.isFinite(last) && nowMs - last >= 0 && nowMs - last <= ONLINE_WINDOW_MS;
  if (!continuing) return new Date(nowMs).toISOString();
  const since = typeof prevOnlineSince === "string" ? Date.parse(prevOnlineSince) : NaN;
  if (Number.isFinite(since) && since <= last) return new Date(since).toISOString();
  return new Date(last).toISOString();
}

/** 偏好（favorites／likes）→ 大類 key（去重、最多 max 個；子類歸到所屬大類）。 */
export function tasteGroupsOf(preferences: unknown, max = 4): string[] {
  if (typeof preferences !== "object" || preferences === null) return [];
  const p = preferences as Record<string, unknown>;
  const out: string[] = [];
  for (const list of [p.favorites, p.likes]) {
    if (!Array.isArray(list)) continue;
    for (const k of list) {
      if (typeof k !== "string") continue;
      const g = groupOfKey(k);
      if (g !== null && !out.includes(g)) out.push(g);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export type NearbyPerson = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  gender: "male" | "female" | null;
  /** 本次上線起點（epoch ms）。 */
  online_since: number;
  /** 最近一次心跳（epoch ms）。 */
  last_seen_at: number;
  /** 距離檔（米），向上取整到 `DISTANCE_BANDS_M`。 */
  distance_band_m: number;
  /** 對方口味大類 key。 */
  taste_groups: string[];
  /** 與我相同的口味大類 key（子集）。 */
  shared_taste_groups: string[];
  relationship: "none" | "friend" | "pending_out" | "pending_in";
};

export type NearbyUserRow = {
  id: unknown;
  nickname: unknown;
  avatar_url: unknown;
  gender: unknown;
  dob: unknown;
  mode: unknown;
  preferences: unknown;
  last_seen_at: unknown;
  online_since?: unknown;
  live_lat: unknown;
  live_lng: unknown;
};

export type NearbyCandidate = { person: NearbyPerson; distM: number };

/** 單行 → 候選；任一丟棄條件命中回 null。距離超 radiusKm 也丟。 */
export function toNearbyCandidate(
  row: NearbyUserRow,
  viewer: LatLng,
  radiusKm: number,
  myTasteGroups: string[],
  relationship: NearbyPerson["relationship"],
  nowMs: number,
): NearbyCandidate | null {
  if (typeof row.id !== "string" || row.id.length === 0) return null;
  if (typeof row.nickname !== "string" || row.nickname.length === 0) return null;
  if (row.mode === "stealth") return null;
  if (isMinorDob(row.dob, nowMs)) return null;
  const rawAvatar = row.avatar_url;
  if (rawAvatar !== null && rawAvatar !== undefined && typeof rawAvatar !== "string") return null;
  const lastSeen = typeof row.last_seen_at === "string" ? Date.parse(row.last_seen_at) : NaN;
  if (!Number.isFinite(lastSeen) || nowMs - lastSeen > ONLINE_WINDOW_MS || lastSeen > nowMs + 60_000) return null;
  if (
    typeof row.live_lat !== "number" || !Number.isFinite(row.live_lat) ||
    typeof row.live_lng !== "number" || !Number.isFinite(row.live_lng)
  ) {
    return null;
  }
  const distM = haversineMeters(viewer, { lat: row.live_lat, lng: row.live_lng });
  if (distM > radiusKm * 1000) return null;
  const sinceRaw = typeof row.online_since === "string" ? Date.parse(row.online_since) : NaN;
  const since = Number.isFinite(sinceRaw) && sinceRaw <= lastSeen ? sinceRaw : lastSeen;
  const groups = tasteGroupsOf(row.preferences);
  return {
    distM,
    person: {
      user_id: row.id,
      nickname: row.nickname,
      avatar_url: typeof rawAvatar === "string" ? rawAvatar : null,
      gender: row.gender === "male" || row.gender === "female" ? row.gender : null,
      online_since: since,
      last_seen_at: lastSeen,
      distance_band_m: distanceBand(distM),
      taste_groups: groups,
      shared_taste_groups: groups.filter((g) => myTasteGroups.includes(g)),
      relationship,
    },
  };
}

/** 本次上線新→舊；同一時刻按精確距離近→遠；再按 id 穩定。回包不含精確距離。 */
export function sortNearby(cands: NearbyCandidate[]): NearbyPerson[] {
  return cands
    .slice()
    .sort(
      (a, b) =>
        b.person.online_since - a.person.online_since ||
        a.distM - b.distM ||
        a.person.user_id.localeCompare(b.person.user_id),
    )
    .map((c) => c.person);
}

/** `radius_km` 查詢參數：缺省 3，夾到 [0.1, 10]；非數字回 null（400）。 */
export function parseRadiusKm(raw: string | null): number | null {
  if (raw === null || raw === "") return NEARBY_PEOPLE_DEFAULT_KM;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(NEARBY_PEOPLE_MAX_KM, Math.max(0.1, n));
}
