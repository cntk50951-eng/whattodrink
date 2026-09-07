/**
 * UR3.3 附近在线判定（纯函数，可单测）。
 *
 * - 在线＝心跳 5 分钟内（mock 用 `onlineAt`，真后端用 `users.last_seen_at`）。
 * - 附近＝和我相距 5km 内（haversine，复用 lib/geo）。
 * - pin 绿点／卡片在线 pill／邀约按钮三处同读这里，不各算各的。
 */

import { haversineMeters } from "./geo";
import type { LatLng } from "./geo";
import type { Checkin } from "./checkins";

/** 心跳窗口：5 分钟内算在线（真后端的心跳间隔必须小于它）。 */
export const ONLINE_WINDOW_MS = 5 * 60_000;
/** 附近半径：5km（用户原话）。 */
export const NEARBY_KM = 5;

/** 在线（只看心跳，不看距离——距离由调用方按需叠加）。 */
export function isOnline(c: Checkin, now: number): boolean {
  return now - c.onlineAt >= 0 && now - c.onlineAt <= ONLINE_WINDOW_MS;
}

/** 在线且在我 5km 内（pin 绿点＋卡片在线态＋可邀约三处共用）。 */
export function isNearbyOnline(
  self: LatLng,
  c: Checkin,
  now: number,
): boolean {
  return (
    isOnline(c, now) && haversineMeters(self, c.position) <= NEARBY_KM * 1000
  );
}
