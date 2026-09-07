import type { Checkin } from "./checkins";
import { haversineMeters, type LatLng } from "./geo";

/**
 * UR2.5 摇一摇选中规则（UI 先行版，纯函数方便单测）。
 * 后端算法落地后换掉这个实现，调用方（DrinkMap）不用改。
 */

/** "最近打过卡"的时间窗口：24 小时。 */
export const RECENT_WINDOW_MS = 24 * 3600_000;

/**
 * 在窗口内按距离取最近的一条；窗口内一条没有 → null（调用方弹 toast，
 * 不跳图不聚焦）。并列距离取第一条（确定性）。
 */
export function pickNearestRecentCheckin(
  self: LatLng,
  checkins: Checkin[],
  nowMs: number,
  windowMs: number = RECENT_WINDOW_MS,
): Checkin | null {
  let best: Checkin | null = null;
  let bestMeters = Number.POSITIVE_INFINITY;
  for (const c of checkins) {
    if (nowMs - c.checkedInAt > windowMs) continue;
    const d = haversineMeters(self, c.position);
    if (d < bestMeters) {
      best = c;
      bestMeters = d;
    }
  }
  return best;
}
