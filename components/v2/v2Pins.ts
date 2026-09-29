/**
 * UR C.1 v2 marker 純映射（可單測）：api pins／MOCK → V2MapView 吃的
 * marker 模型。fuzz／過濾邏輯住在 lib（`toPinJson`），這裡只做形狀轉換。
 */

import type { PinJson } from "../../lib/api/pins";
import { MOCK_CHECKINS } from "../../lib/checkins";
import type { Checkin } from "../../lib/checkins";

export type V2Marker = {
  id: string;
  lat: number;
  lng: number;
  /** 首字（暱稱首字，無則酒字；有酒圖時退居 fallback）。 */
  label: string;
  online: boolean;
  /** UR C.6 round-7：釘面改酒圖標——展示名（本地 SVG 解析用）與 emoji（回退）。 */
  drink: string | null;
  drinkEmoji: string | null;
  /** UR E.5：打卡时间 epoch ms（热力 24h 窗用；MOCK 无时间即 null 不进热）。 */
  at: number | null;
};

export function apiPinsToMarkers(pins: readonly PinJson[]): V2Marker[] {
  return pins.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    label: (p.nickname ?? p.drinkName ?? "酒").slice(0, 1),
    online: p.isOnline,
    drink: p.drinkName,
    drinkEmoji: p.drinkEmoji,
    at: p.checkedInAt,
  }));
}

export function mockToMarkers(checkins: readonly Checkin[] = MOCK_CHECKINS): V2Marker[] {
  return checkins.map((c) => ({
    id: c.id,
    lat: c.position.lat,
    lng: c.position.lng,
    label: (c.nickname ?? c.drinkName ?? "酒").slice(0, 1),
    online: false,
    drink: c.drinkName,
    drinkEmoji: c.drinkEmoji,
    at: c.checkedInAt,
  }));
}
