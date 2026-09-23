/**
 * UR A.7 登出后本地缓存清理 — 登出后私有打卡/墙贴在匿名态不应再可见。
 * 集成登录+DB 后，不应再有跨会话的本地持久化残留。
 */

import {
  WALL_OVERRIDES_KEY,
  WALL_SEEN_KEY,
  WALL_STORAGE_KEY,
} from "../posts";
import {
  WANT_HISTORY_KEY,
  WANT_STORAGE_KEY,
} from "../wantRecord";

/** 用户私有缓存 key（登出时整批清除；非用户维度如相机同意保留） */
export const USER_CACHE_KEYS = [
  WALL_STORAGE_KEY,
  WALL_OVERRIDES_KEY,
  WALL_SEEN_KEY,
  WANT_STORAGE_KEY,
  WANT_HISTORY_KEY,
  "wtd-cheers-daily",
] as const;

/** 清除登录用户在本地的私有缓存（登出时调用；SSR 时 no-op）。 */
export function clearUserLocalCaches(): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  for (const key of USER_CACHE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // storage 不可用不挡登出流程
    }
  }
}
